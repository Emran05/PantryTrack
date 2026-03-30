import React from 'react';

export default function PixelReceipt() {
  const receiptItems = [
    { qty: 1, name: 'APPLES HONEYCR', price: '4.99' },
    { qty: 2, name: 'CARROTS ORGANIC', price: '3.50' },
    { qty: 1, name: 'BEEF RIBEYE', price: '18.25' },
    { qty: 1, name: 'WHOLE MILK 1G', price: '3.99' },
    { qty: 1, name: 'EGGS DOZEN AA', price: '4.29' },
    { qty: 1, name: 'BREAD SOURDOUGH', price: '5.49' },
    { qty: 3, name: 'AVOCADO LARGE', price: '6.00' },
    { qty: 1, name: 'PASTA SPAGHETTI', price: '1.99' },
    { qty: 1, name: 'PASTA SAUCE', price: '3.49' },
    { qty: 2, name: 'TOILET PAPER', price: '12.99' },
    { qty: 1, name: 'PAPER TOWELS', price: '14.99' },
    { qty: 1, name: 'COFFEE BEANS', price: '11.99' },
    { qty: 1, name: 'SPINACH BAGGED', price: '2.99' },
    { qty: 1, name: 'CHICKEN BREAST', price: '9.85' },
    { qty: 1, name: 'TORTILLAS', price: '3.25' },
    { qty: 1, name: 'CHEDDAR SHARP', price: '4.50' },
  ];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      // Jagged edge effect on top and bottom
      background: `
        linear-gradient(135deg, transparent 5px, rgba(253,253,253,0.9) 0) top left,
        linear-gradient(-135deg, transparent 5px, rgba(253,253,253,0.9) 0) top right,
        linear-gradient(45deg, transparent 5px, rgba(253,253,253,0.9) 0) bottom left,
        linear-gradient(-45deg, transparent 5px, rgba(253,253,253,0.9) 0) bottom right
      `,
      backgroundSize: '50% 50%',
      backgroundRepeat: 'no-repeat',
      color: '#111',
      fontFamily: "'Courier New', Courier, monospace", // Pixel/receipt font
      fontSize: '11px',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Background fill for body of receipt */}
      <div style={{
        position: 'absolute',
        top: '6px', bottom: '6px', left: 0, right: 0,
        backgroundColor: 'rgba(253,253,253,0.9)',
        zIndex: 0
      }}></div>

      {/* Scrollable Container */}
      <div className="receipt-scroll-container" style={{
        position: 'relative',
        zIndex: 1,
        padding: '24px 16px',
        overflowY: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}>PANTRY SNAP CO.</div>
          <div>123 MAIN STREET</div>
          <div>SAN FRANCISCO, CA</div>
          <div style={{ marginTop: '8px' }}>STORE #404  REG #04</div>
          <div>--------------------------</div>
        </div>

        <div style={{ flex: 1 }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
            <span style={{ width: '20px' }}>QTY</span>
            <span style={{ flex: 1, paddingLeft: '8px' }}>ITEM</span>
            <span>PRICE</span>
          </div>
          
          {/* Items */}
          {receiptItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ width: '20px', textAlign: 'right' }}>{item.qty}</span>
              <span style={{ flex: 1, paddingLeft: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name}
              </span>
              <span>{item.price}</span>
            </div>
          ))}
          
        </div>
        
        <div style={{ marginTop: '16px', borderTop: '1px dashed #777', paddingTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>SUBTOTAL</span>
            <span>108.70</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>TAX (8.5%)</span>
            <span>9.24</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>
            <span>TOTAL</span>
            <span>$117.94</span>
          </div>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '24px', whiteSpace: 'pre' }}>
          <div>**************************</div>
          <div style={{ marginTop: '8px' }}>THANK YOU FOR</div>
          <div>SHOPPING WITH US</div>
          <div style={{ fontSize: '24px', marginTop: '8px' }}>BARCODE</div>
          <div>**************************</div>
        </div>
        
      </div>
      
      {/* Hide scrollbar styles */}
      <style>{`
        .receipt-scroll-container::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
      `}</style>
    </div>
  );
}
