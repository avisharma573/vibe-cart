
import { useEffect, useMemo, useState } from 'react'

const api = {
  async products() {
    const r = await fetch('/api/products')
    if (!r.ok) throw new Error('Failed to load products')
    return r.json()
  },
  async getCart() {
    const r = await fetch('/api/cart')
    if (!r.ok) throw new Error('Failed to load cart')
    return r.json()
  },
  async addToCart(productId, qty) {
    const r = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, qty })
    })
    if (!r.ok) throw new Error('Failed to update cart')
    return r.json()
  },
  async remove(productId) {
    const r = await fetch(`/api/cart/${productId}`, { method: 'DELETE' })
    if (!r.ok) throw new Error('Failed to remove item')
    return r.json()
  },
  async checkout() {
    const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    if (!r.ok) throw new Error('Checkout failed')
    return r.json()
  }
}

function useCart() {
  const [state, setState] = useState({ items: [], total: 0 })
  const refresh = async () => setState(await api.getCart())
  const setQty = async (id, qty) => setState(await api.addToCart(id, qty))
  const remove = async (id) => setState(await api.remove(id))
  useEffect(() => { refresh() }, [])
  return { cart: state, refresh, setQty, remove }
}

export default function App() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const { cart, setQty, remove } = useCart()

  useEffect(() => {
    api.products().then(setProducts).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const add = async (id) => {
    try {
      await setQty(id, 1 + (cart.items.find(i => i.id === id)?.qty || 0))
    } catch (e) {
      alert(e.message)
    }
  }

  const updateQty = async (id, qty) => {
    try {
      await setQty(id, qty)
    } catch (e) {
      alert(e.message)
    }
  }

  const onCheckout = async (e) => {
    e.preventDefault()
    try {
      const r = await api.checkout()
      setReceipt(r)
      setShowReceipt(true)
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🛒 Vibe Cart</h1>
        <div className="row">
          <strong>Items:</strong> {cart.items.length}
          <strong style={{marginLeft:8}}>Total:</strong> ₹{cart.total.toFixed(2)}
        </div>
      </div>

      <div className="row" style={{alignItems:'start'}}>
        <div style={{flex: 2}}>
          <h2>Products</h2>
          {loading ? <p>Loading...</p> : error ? <p style={{color:'crimson'}}>{error}</p> : (
            <div className="grid">
              {products.map(p => (
                <div key={p.id} className="card">
                  <div className="img">{p.image || '🛍️'}</div>
                  <div className="name">{p.name}</div>
                  <div className="price">₹{p.price.toFixed(2)}</div>
                  <button className="btn" onClick={() => add(p.id)}>Add to Cart</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="right" style={{flex: 1}}>
          <h2>Cart</h2>
          <div className="cart">
            {cart.items.length === 0 && <p>No items yet.</p>}
            {cart.items.map(item => (
              <div key={item.id} className="cart-item">
                <div style={{fontSize:24}}>{item.image}</div>
                <div>
                  <div style={{fontWeight:600}}>{item.name}</div>
                  <div>₹{item.price.toFixed(2)}</div>
                </div>
                <div>
                  <input type="number" min="1" value={item.qty} onChange={e => updateQty(item.id, Math.max(1, Number(e.target.value||1)))} style={{width:'100%', padding:'8px', borderRadius:8, border:'1px solid #e5e7eb'}}/>
                </div>
                <div>₹{(item.price*item.qty).toFixed(2)}</div>
                <div>
                  <button className="btn secondary" onClick={() => remove(item.id)}>Remove</button>
                </div>
              </div>
            ))}
            <div className="footer">
              <strong>Total: ₹{cart.total.toFixed(2)}</strong>
              <form onSubmit={onCheckout} className="row" style={{flexWrap:'wrap'}}>
                <input required placeholder="Name" style={{padding:'10px', border:'1px solid #e5e7eb', borderRadius:10}}/>
                <input required type="email" placeholder="Email" style={{padding:'10px', border:'1px solid #e5e7eb', borderRadius:10}}/>
                <button className="btn" type="submit">Checkout</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {showReceipt && receipt && (
        <div className="modal-backdrop" onClick={() => setShowReceipt(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Receipt</h3>
            <p><strong>ID:</strong> {receipt.id}</p>
            <p><strong>When:</strong> {new Date(receipt.timestamp).toLocaleString()}</p>
            <ul>
              {receipt.items.map(it => (
                <li key={it.id}>{it.qty} × {it.name} — ₹{(it.price * it.qty).toFixed(2)}</li>
              ))}
            </ul>
            <p><strong>Total Paid:</strong> ₹{receipt.total.toFixed(2)}</p>
            <div style={{textAlign:'right'}}>
              <button className="btn" onClick={() => setShowReceipt(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
