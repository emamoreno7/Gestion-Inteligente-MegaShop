export const categoryKeywords: Record<string, string[]> = {
    jugueteria: [
      'juguete', 'muñeca', 'muñeco', 'auto a fricción', 'autito', 'auto de juguete',
      'pelota', 'rompecabezas', 'puzzle', 'juego de mesa', 'juego didáctico',
      'didáctico', 'bloques', 'cubos', 'sonajero', 'triciclo', 'monopatín',
      'patineta', 'peluche', 'lego', 'playmobil', 'barbie', 'hot wheels',
      'mecano', 'robot', 'dinosaurio', 'superhéroe', 'avión de juguete',
      'tren de juguete', 'barco de juguete', 'muñeca articulada', 'muñeco articulado',
    ],
    bazar: [
      'vajilla', 'olla', 'sartén', 'vaso', 'taza', 'plato', 'cubierto', 'cuchillo',
      'tenedor', 'cuchara', 'termo', 'botella', 'jarra', 'bandeja', 'fuente',
      'espejo', 'portarretrato', 'florero', 'vela', 'aromatizante', 'limpieza',
      'escoba', 'trapo', 'balde', 'tacho', 'basura', 'ferretería', 'herramienta',
      'destornillador', 'martillo', 'pinza', 'taladro', 'tornillo', 'clavo',
      'pincel', 'rodillo', 'pintura', 'maceta', 'organizador', 'repisa',
      'perchero', 'cortina', 'alfombra', 'felpudo', 'canasto', 'cesto',
    ],
    ropa: [
      'remera', 'camisa', 'pantalón', 'jean', 'bermuda', 'short', 'pollera',
      'vestido', 'buzo', 'campera', 'abrigo', 'tapado', 'chaleco', 'sweater',
      'suéter', 'media', 'calcetín', 'calzoncillo', 'bombacha', 'sostén',
      'ropa interior', 'pijama', 'bata', 'traje de baño', 'malla', 'bikini',
      'calzado', 'zapatilla', 'zapato', 'sandalia', 'bota', 'alpargata',
      'ojota', 'chancleta', 'gorra', 'sombrero', 'bufanda', 'guante',
      'cinturón', 'corbata', 'pañuelo', 'accesorio de vestir',
    ],
    regaleria: [
      'regalo', 'bijouterie', 'collar', 'pulsera', 'anillo', 'aro', 'pendientes',
      'reloj', 'billetera', 'monedero', 'llavero', 'pluma', 'lapicera', 'bolígrafo',
      'cuaderno', 'agenda', 'tarjeta', 'papel de regalo', 'moño', 'cinta',
      'perfume', 'esmalte', 'maquillaje', 'cosmético', 'porta retrato',
      'figura decorativa', 'adorno', 'vela aromática', 'difusor',
    ],
    otros: [] // vacío: se usa si no hay coincidencia
  }
  
  export function classifyByKeywords(name: string | undefined | null): string | null {
    if (typeof name !== 'string' || name.trim() === '') return null
    const cleanName = name.toLowerCase().trim()
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (category === 'otros') continue
      for (const keyword of keywords) {
        if (cleanName.includes(keyword)) {
          return category
        }
      }
    }
    return null // no se pudo clasificar por palabras clave
  }