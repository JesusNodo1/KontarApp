export const INV = {
  id: 1,
  nombre: 'Inventario Julio 2025',
  descripcion: 'Conteo general de stock para cierre de mes. Incluye todos los pasillos del depósito y estantería de sala de ventas.',
  sucursal: 'Sucursal Centro',
  deposito: 'Depósito Central – Av. Corrientes 1420',
  fecha_inicio: '15/07/2025',
  fecha_limite: '18/07/2025',
  responsable: 'Lic. Marcos Díaz',
  estado: 'abierto',
  total_productos: 248,
}

export const ZONAS_I = [
  { id: 1, nombre: 'Estante 1 – Pasillo A', descripcion: 'Bebidas y lácteos',   productos_contados: 8,  total_productos: 32, finalizada: false },
  { id: 2, nombre: 'Estante 2 – Pasillo B', descripcion: 'Secos y almacén',     productos_contados: 27, total_productos: 27, finalizada: true  },
  { id: 3, nombre: 'Depósito Trasero',       descripcion: 'Stock de reserva',    productos_contados: 3,  total_productos: 41, finalizada: false },
  { id: 4, nombre: 'Sala de Ventas',         descripcion: 'Exhibición al público',productos_contados: 0,  total_productos: 19, finalizada: false },
]

export const DB = {
  '784000123456':  { id: 1, nombre: 'Coca Cola',      variante: 'Original 500ml',    sku: '784000123456'  },
  '7501234567890': { id: 2, nombre: 'Arroz Gallo',    variante: '1kg',               sku: '7501234567890' },
  '7501055300054': { id: 3, nombre: 'Leche Lala',     variante: 'Entera 1L',         sku: '7501055300054' },
  '7790895000084': { id: 4, nombre: 'Aceite Natura',  variante: '900ml',             sku: '7790895000084' },
  '7790070012345': { id: 5, nombre: 'Fideos Marolio', variante: 'Spaghetti 500g',    sku: '7790070012345' },
  '7891150031218': { id: 6, nombre: 'Jabón Dove',     variante: '90g x3',            sku: '7891150031218' },
}
