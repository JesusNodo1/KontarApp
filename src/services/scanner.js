let _zx = null

export const loadZx = () => {
  if (!_zx) _zx = import('@zxing/library').catch(() => null)
  return _zx
}
