import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../../context/AppContext';

const CartItem = ({
  item,
  isSavedMode = false,
  onQuantityChange,
  onRemove,
  onSaveForLater,
  onMoveToCart,
}) => {
  const { formatPrice, navigateTo } = useApp();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="lumora-glass-card cart-item-card"
    >
      {/* Product Image */}
      <div className="cart-item-img-wrapper" onClick={() => navigateTo('product-detail', item.id)} style={{ cursor: 'pointer' }}>
        <img
          src={item.image}
          alt={item.title}
          className="cart-item-img"
          loading="lazy"
        />
      </div>

      {/* Product Details */}
      <div className="cart-item-info">
        <h3 className="cart-item-title" onClick={() => navigateTo('product-detail', item.id)} style={{ cursor: 'pointer' }}>{item.title}</h3>
        <div className="cart-item-meta">
          <span className="cart-item-creator">by {item.creator}</span>
          <span className="cart-item-meta-dot" />
          <span>{item.category}</span>
          <span className="cart-item-meta-dot" />
          <span>{item.license}</span>
        </div>

        {/* Product Tags */}
        <div className="cart-item-tags">
          {item.tags &&
            item.tags.map((tag) => (
              <span key={tag} className="tag-pill" data-tag={tag}>
                {tag}
              </span>
            ))}
        </div>
      </div>

      {/* Controls & Price */}
      <div className="cart-item-controls-price">
        <span className="cart-item-price">
          {formatPrice(item.price * (isSavedMode ? 1 : item.quantity))}
        </span>

        <div className="cart-item-actions">
          {/* Quantity Controls */}
          {!isSavedMode && (
            <div className="quantity-control">
              <button
                type="button"
                className="quantity-btn"
                onClick={() => onQuantityChange(item.id, -1)}
                aria-label="Decrease quantity"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <span className="quantity-val">{item.quantity}</span>
              <button
                type="button"
                className="quantity-btn"
                onClick={() => onQuantityChange(item.id, 1)}
                aria-label="Increase quantity"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          )}

          {/* Action: Save For Later or Move to Cart */}
          {isSavedMode ? (
            <button
              type="button"
              className="action-btn"
              onClick={() => onMoveToCart(item.id)}
              title="Restore to active cart"
              aria-label="Restore to active cart"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="action-btn"
              onClick={() => onSaveForLater(item.id)}
              title="Save for later"
              aria-label="Save for later"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}

          {/* Action: Delete / Remove */}
          <button
            type="button"
            className="action-btn btn-remove"
            onClick={() => onRemove(item.id)}
            title="Delete product"
            aria-label="Delete product"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default CartItem;
