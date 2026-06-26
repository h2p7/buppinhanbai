// ==========================================================================
// script.js - カート管理 & メール送信処理 (EmailJS連携)
// ==========================================================================

// 1. EmailJS 設定項目
// ※ 後日、EmailJSのアカウントを作成し、以下の値を書き換えてください。
const EMAILJS_CONFIG = {
    PUBLIC_KEY: "YOUR_PUBLIC_KEY",       // 例: "user_xxxxxxxxx" または公開キー
    SERVICE_ID: "YOUR_SERVICE_ID",       // 例: "service_xxxxxxx"
    TEMPLATE_ID: "YOUR_TEMPLATE_ID"      // 例: "template_xxxxxxx"
};

// 開発用デモモード（EmailJSが設定されていない場合にダミーで成功させる）
const IS_DEMO_MODE = EMAILJS_CONFIG.PUBLIC_KEY === "YOUR_PUBLIC_KEY";

// 2. カート状態の管理
let cart = [];

// DOMの読み込み完了時に実行
document.addEventListener("DOMContentLoaded", () => {
    // UI要素の取得
    const cartCountBadge = document.getElementById("cart-count");
    const openCartBtn = document.getElementById("open-cart-btn");
    const closeCartBtn = document.getElementById("close-cart-btn");
    const cartModal = document.getElementById("cart-modal");
    const cartOverlay = document.getElementById("cart-overlay");
    const cartItemsContainer = document.getElementById("cart-items");
    const summaryTotalQty = document.getElementById("summary-total-qty");
    const summaryTotalPrice = document.getElementById("summary-total-price");
    const orderForm = document.getElementById("order-form");
    const submitBtn = document.getElementById("submit-btn");
    
    // カテゴリタブ
    const tabButtons = document.querySelectorAll(".tab-btn");
    const productCards = document.querySelectorAll(".product-card");

    // EmailJSの初期化 (デモモード以外)
    if (!IS_DEMO_MODE) {
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    } else {
        console.log("Antigravity: EmailJS is running in DEMO MODE. Submissions will simulate success.");
    }

    // カートデータの初期読み込み (ローカルストレージ)
    loadCartFromStorage();
    updateCartUI();

    /* ==========================================
       カテゴリー切り替え (Tabs)
       ========================================== */
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            // アクティブクラスの切り替え
            tabButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            const selectedCategory = button.getAttribute("data-category");

            productCards.forEach(card => {
                const cardCategory = card.getAttribute("data-category");
                
                if (selectedCategory === "all" || cardCategory === selectedCategory) {
                    card.style.display = "flex";
                    // アニメーション効果のための微調整
                    setTimeout(() => {
                        card.style.opacity = "1";
                        card.style.transform = "translateY(0)";
                    }, 50);
                } else {
                    card.style.opacity = "0";
                    card.style.transform = "translateY(10px)";
                    setTimeout(() => {
                        card.style.display = "none";
                    }, 300); // CSSのTransition時間と合わせる
                }
            });
        });
    });

    /* ==========================================
       数量操作 (商品カード内)
       ========================================== */
    productCards.forEach(card => {
        const minusBtn = card.querySelector(".minus-btn");
        const plusBtn = card.querySelector(".plus-btn");
        const qtyInput = card.querySelector(".qty-input");

        minusBtn.addEventListener("click", () => {
            let val = parseInt(qtyInput.value) || 1;
            if (val > 1) {
                qtyInput.value = val - 1;
            }
        });

        plusBtn.addEventListener("click", () => {
            let val = parseInt(qtyInput.value) || 1;
            if (val < 99) {
                qtyInput.value = val + 1;
            }
        });

        // 直接入力時のバリデーション
        qtyInput.addEventListener("change", () => {
            let val = parseInt(qtyInput.value);
            if (isNaN(val) || val < 1) qtyInput.value = 1;
            if (val > 99) qtyInput.value = 99;
        });
    });

    /* ==========================================
       カートモーダルの開閉
       ========================================== */
    const openCart = () => {
        cartModal.classList.add("open");
        document.body.style.overflow = "hidden"; // 背景スクロール無効化
    };

    const closeCart = () => {
        cartModal.classList.remove("open");
        document.body.style.overflow = ""; // 背景スクロール有効化
    };

    openCartBtn.addEventListener("click", openCart);
    closeCartBtn.addEventListener("click", closeCart);
    cartOverlay.addEventListener("click", closeCart);

    /* ==========================================
       カートへの追加ロジック
       ========================================== */
    const addCartButtons = document.querySelectorAll(".btn-add-cart");
    addCartButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const name = btn.getAttribute("data-name");
            const price = parseInt(btn.getAttribute("data-price"));
            
            // 該当商品の数量インプットを取得
            const card = btn.closest(".product-card");
            const qtyInput = card.querySelector(".qty-input");
            const qty = parseInt(qtyInput.value) || 1;

            addToCart(id, name, price, qty);
            
            // マイクロアニメーション: ボタンを一時的に変更
            const originalContent = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> カートに追加しました`;
            btn.style.backgroundColor = "var(--color-success)";
            btn.style.color = "var(--color-white)";
            btn.disabled = true;

            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.style.backgroundColor = "";
                btn.style.color = "";
                btn.disabled = false;
                qtyInput.value = 1; // 数量を1にリセット
            }, 1200);

            // トースト通知を表示
            showToast(`${name} を ${qty}点 カートに追加しました`);
        });
    });

    function addToCart(id, name, price, qty) {
        const existingItem = cart.find(item => item.id === id);
        
        if (existingItem) {
            existingItem.qty += qty;
        } else {
            cart.push({ id, name, price, qty });
        }
        
        saveCartToStorage();
        updateCartUI();
    }

    /* ==========================================
       UIと数量の同期処理
       ========================================== */
    function updateCartUI() {
        // カートバッジ更新
        const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);
        cartCountBadge.textContent = totalItemsCount;
        
        if (totalItemsCount > 0) {
            cartCountBadge.style.display = "flex";
            submitBtn.disabled = false; // カートが空でなければ送信ボタン有効
        } else {
            cartCountBadge.style.display = "none";
            submitBtn.disabled = true;  // 空なら無効
        }

        // モーダル内のリスト表示の更新
        cartItemsContainer.innerHTML = "";
        
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = `<p class="empty-cart-msg">カートに商品が入っていません。</p>`;
            summaryTotalQty.textContent = "0点";
            summaryTotalPrice.textContent = "¥0";
            return;
        }

        let totalPrice = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.qty;
            totalPrice += itemTotal;

            const itemElement = document.createElement("div");
            itemElement.className = "cart-item";
            itemElement.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">¥${item.price.toLocaleString()} &times; ${item.qty}</div>
                </div>
                <div class="cart-item-actions">
                    <div class="quantity-controls">
                        <button class="qty-btn modal-minus-btn" data-id="${item.id}"><i class="fa-solid fa-minus"></i></button>
                        <span class="qty-input" style="line-height:32px; width:30px; display:inline-block; font-weight:700;">${item.qty}</span>
                        <button class="qty-btn modal-plus-btn" data-id="${item.id}"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <button class="btn-remove-item" data-id="${item.id}" aria-label="削除"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            cartItemsContainer.appendChild(itemElement);
        });

        summaryTotalQty.textContent = `${totalItemsCount}点`;
        summaryTotalPrice.textContent = `¥${totalPrice.toLocaleString()}`;

        // イベントリスナーの再設定 (モーダル内の数量操作と削除)
        setupModalEvents();
    }

    function setupModalEvents() {
        // カート内マイナス
        document.querySelectorAll(".modal-minus-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const item = cart.find(i => i.id === id);
                if (item && item.qty > 1) {
                    item.qty--;
                    saveCartToStorage();
                    updateCartUI();
                }
            });
        });

        // カート内プラス
        document.querySelectorAll(".modal-plus-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const item = cart.find(i => i.id === id);
                if (item && item.qty < 99) {
                    item.qty++;
                    saveCartToStorage();
                    updateCartUI();
                }
            });
        });

        // カート内削除
        document.querySelectorAll(".btn-remove-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                cart = cart.filter(item => item.id !== id);
                saveCartToStorage();
                updateCartUI();
                showToast("カートから削除しました");
            });
        });
    }

    /* ==========================================
       トースト通知ユーティリティ
       ========================================== */
    function showToast(message) {
        // 既存のトーストがあれば削除
        const existingToast = document.querySelector(".toast-notification");
        if (existingToast) existingToast.remove();

        const toast = document.createElement("div");
        toast.className = "toast-notification";
        toast.innerHTML = `<i class="fa-solid fa-circle-check toast-icon-success"></i> <span>${message}</span>`;
        document.body.appendChild(toast);

        // 表示アニメーション
        setTimeout(() => {
            toast.classList.add("show");
        }, 50);

        // 3秒後に消去
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* ==========================================
       ローカルストレージの永続化
       ========================================== */
    function saveCartToStorage() {
        localStorage.setItem("omonikai_cart", JSON.stringify(cart));
    }

    function loadCartFromStorage() {
        const stored = localStorage.getItem("omonikai_cart");
        if (stored) {
            try {
                cart = JSON.parse(stored);
            } catch (e) {
                cart = [];
            }
        }
    }

    /* ==========================================
       注文フォーム送信 & EmailJS連携
       ========================================== */
    orderForm.addEventListener("submit", (e) => {
        e.preventDefault(); // 通常の送信を抑止

        if (cart.length === 0) {
            alert("カートに商品が入っていません。");
            return;
        }

        // 入力値取得
        const userName = document.getElementById("user-name").value.trim();
        const userBranch = document.getElementById("user-branch").value.trim();
        const userPhone = document.getElementById("user-phone").value.trim();
        const orderNotes = document.getElementById("order-notes").value.trim();

        // 注文テキストの整形
        let orderItemsText = "";
        let totalPrice = 0;
        let totalQty = 0;

        cart.forEach((item, index) => {
            const itemTotal = item.price * item.qty;
            totalPrice += itemTotal;
            totalQty += item.qty;
            orderItemsText += `${index + 1}. ${item.name} × ${item.qty} = ¥${itemTotal.toLocaleString()}\n`;
        });

        const fullOrderMessage = `
【注文者情報】
・お名前: ${userName}
・支部 / 分会: ${userBranch || "未記入"}
・電話番号: ${userPhone}
・備考・ご要望: ${orderNotes || "なし"}

【注文内容】
${orderItemsText}
----------------------------------------
合計品数: ${totalQty}点
合計金額: ¥${totalPrice.toLocaleString()}
        `.trim();

        // ローディング開始
        showLoader("注文情報を送信しています...");

        // メール送信のパラメータ (EmailJSテンプレート変数に合わせる)
        const templateParams = {
            user_name: userName,
            user_branch: userBranch || "未記入",
            user_phone: userPhone,
            order_notes: orderNotes || "なし",
            order_details: fullOrderMessage,
            total_price: `¥${totalPrice.toLocaleString()}`,
            total_qty: `${totalQty}点`
        };

        if (IS_DEMO_MODE) {
            // デモモード：ダミー遅延のあと成功を表示
            console.log("--- DEMO MODE SUBMISSION ---");
            console.log("Template Parameters Sent to EmailJS:", templateParams);
            
            setTimeout(() => {
                hideLoader();
                clearCart();
                closeCart();
                showSuccessModal(userName, totalPrice);
            }, 1500);
        } else {
            // 本番モード: EmailJS API呼び出し
            emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ID, templateParams)
                .then((response) => {
                    console.log("SUCCESS!", response.status, response.text);
                    hideLoader();
                    clearCart();
                    closeCart();
                    showSuccessModal(userName, totalPrice);
                }, (error) => {
                    console.error("FAILED...", error);
                    hideLoader();
                    alert(`注文の送信に失敗しました。\nエラー内容: ${error.text || error}\nお手数ですが、学校までお電話にてご注文ください。`);
                });
        }
    });

    // カートの全クリア
    function clearCart() {
        cart = [];
        saveCartToStorage();
        updateCartUI();
    }

    /* ==========================================
       ローディング画面の制御
       ========================================== */
    function showLoader(message) {
        let loader = document.querySelector(".loader-overlay");
        if (!loader) {
            loader = document.createElement("div");
            loader.className = "loader-overlay";
            loader.innerHTML = `
                <div class="spinner"></div>
                <div class="loader-message">${message}</div>
            `;
            document.body.appendChild(loader);
        } else {
            loader.querySelector(".loader-message").textContent = message;
        }
        
        setTimeout(() => {
            loader.classList.add("show");
        }, 50);
    }

    function hideLoader() {
        const loader = document.querySelector(".loader-overlay");
        if (loader) {
            loader.classList.remove("show");
            setTimeout(() => loader.remove(), 300);
        }
    }

    /* ==========================================
       注文完了ポップアップ (サクセスモーダル)
       ========================================== */
    function showSuccessModal(userName, totalPrice) {
        let successModal = document.querySelector(".checkout-success-modal");
        if (!successModal) {
            successModal = document.createElement("div");
            successModal.className = "checkout-success-modal";
            successModal.innerHTML = `
                <div class="success-modal-content">
                    <div class="success-icon-wrapper">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <h3>ご注文を受け付けました</h3>
                    <p><strong>${userName} 様</strong>、オモニ会物品販売でのご注文ありがとうございました。</p>
                    <p>ご注文内容は無事管理者に送信されました。お渡し日（5月16日）に、代金 <strong>¥${totalPrice.toLocaleString()}</strong> をご用意の上、学校にて商品をお受け取りください。</p>
                    <button class="btn btn-primary" id="btn-close-success" style="width: 120px;">閉じる</button>
                </div>
            `;
            document.body.appendChild(successModal);
            
            document.getElementById("btn-close-success").addEventListener("click", () => {
                successModal.classList.remove("show");
                setTimeout(() => successModal.remove(), 300);
            });
        }

        setTimeout(() => {
            successModal.classList.add("show");
        }, 50);
    }
});
