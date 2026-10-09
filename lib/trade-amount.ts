// Monto de una compra o venta (puro). Para bonos y ONs Cocos informa el precio
// cada 100 nominales, así que cantidad × precio da 100 veces el monto real: si
// la operación vino de Cocos se usa el bruto del movimiento (`grossAmount`).
// Las cargadas a mano no tienen movimiento y usan cantidad × precio.
export function tradeGrossAmount(trade: {
  quantity: number;
  price: number;
  movementGross?: number | null;
}): number {
  if (trade.movementGross != null) return Math.abs(trade.movementGross);
  return Math.abs(trade.quantity) * trade.price;
}
