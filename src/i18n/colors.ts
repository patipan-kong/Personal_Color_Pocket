const exactThai: Record<string, string> = {
  'Yellow Gold': 'ทอง',
  'Champagne Gold': 'แชมเปญโกลด์',
  'Rose Gold': 'โรสโกลด์',
  Silver: 'เงิน',
  'White Gold': 'ไวท์โกลด์',
  'Optic White': 'ขาวสว่าง',
  'Pure White': 'ขาวสะอาด',
  'Soft White': 'ขาวนวล',
  'Warm Ivory': 'ไอวอรี่โทนอุ่น',
  'Clear Ivory': 'ไอวอรี่สว่าง',
  'Blue Grey': 'เทาอมฟ้า',
  'Blue Pink': 'ชมพูอมฟ้า',
  'Blue Red': 'แดงอมฟ้า',
  'Rose Beige': 'เบจอมชมพูกุหลาบ',
  'Rose Brown': 'น้ำตาลอมชมพูกุหลาบ',
  'Olive Brown': 'น้ำตาลโอลีฟ',
  'Aubergine Brown': 'น้ำตาลอมม่วง',
  'Warm Coral': 'คอรัลโทนอุ่น',
  'Warm Navy': 'เนวี่โทนอุ่น',
  'Apple Green': 'เขียวแอปเปิล',
  'Mint Leaf': 'เขียวมินต์',
  'Aqua Glass': 'อควาใส',
  'Petal Pink': 'ชมพูกลีบดอก',
  'Leaf Green': 'เขียวใบไม้',
  'Bottle Green': 'เขียวขวด',
  'Emerald Green': 'เขียวเอเมอรัลด์',
  'Sea Green': 'เขียวทะเล',
  'Blue Sage': 'เขียวเซจอมฟ้า',
  'Blue Teal': 'ทีลอมฟ้า',
  'Pearl Grey': 'เทามุก',
  'Silver Grey': 'เทาเงิน',
  'Ice Grey': 'เทาไอซ์',
  'Cool Grey': 'เทาโทนเย็น',
  'Warm Dove': 'เทาโดฟโทนอุ่น',
  Cream: 'ครีม',
  Camel: 'คาเมล',
  Olive: 'เขียวโอลีฟ',
}

const modifierSuffixes: Record<string, string> = {
  Warm: 'โทนอุ่น', Cool: 'โทนเย็น', Light: 'อ่อน', Deep: 'เข้ม', Dark: 'เข้ม',
  Soft: 'นุ่มนวล', Bright: 'สดใส', Clear: 'สดใส', Muted: 'หม่น', Dusty: 'หม่น',
  Smoky: 'หม่นควัน', Golden: 'โทนทอง', Icy: 'ไอซ์', Ice: 'ไอซ์', Electric: 'สดจัด',
  Neon: 'นีออน', Hot: 'สด', Pale: 'อ่อน', Pure: 'สะอาด', True: 'แท้', Optic: 'สว่าง',
  Polished: 'เงาวาว', Brushed: 'ปัดด้าน', Antique: 'แอนทีค', Aged: 'วินเทจ',
  Burnished: 'เงาไหม้', Burnt: 'โทนไหม้', Fresh: 'สดชื่น', Sunlit: 'สว่างอุ่น',
  Spiced: 'โทนเครื่องเทศ', Old: 'วินเทจ', Baby: 'พาสเทล', Powder: 'พาวเดอร์',
}

const thaiTerms: Record<string, string> = {
  Acid: 'แอซิด', Adobe: 'อะโดบี', Amber: 'แอมเบอร์', Amethyst: 'อะเมทิสต์', Apple: 'แอปเปิล',
  Apricot: 'แอปริคอต', Aqua: 'อควา', Aubergine: 'ออเบอร์จีน', Avocado: 'อะโวคาโด', Azure: 'อาซัวร์',
  Beige: 'เบจ', Berry: 'เบอร์รี', Black: 'ดำ', Bloom: 'บลูม', Blue: 'ฟ้า', Bluebell: 'บลูเบลล์',
  Blueberry: 'บลูเบอร์รี', Bottle: 'ขวด', Brick: 'อิฐ', Bronze: 'บรอนซ์', Brown: 'น้ำตาล',
  Burgundy: 'เบอร์กันดี', Buttercup: 'บัตเตอร์คัพ', Camel: 'คาเมล', Caramel: 'คาราเมล',
  Caribbean: 'แคริบเบียน', Champagne: 'แชมเปญ', Charcoal: 'ชาร์โคล', Cherry: 'เชอร์รี', Chili: 'ชิลี',
  Chocolate: 'ช็อกโกแลต', Cinnamon: 'ซินนามอน', Clay: 'ดินเผา', Cobalt: 'โคบอลต์', Cocoa: 'โกโก้',
  Cognac: 'คอนญัก', Copper: 'คอปเปอร์', Coral: 'คอรัล', Cornflower: 'คอร์นฟลาวเวอร์', Cranberry: 'แครนเบอร์รี',
  Cream: 'ครีม', Daffodil: 'แดฟโฟดิล', Denim: 'เดนิม', Dove: 'โดฟ', Ecru: 'อีครู', Emerald: 'เอเมอรัลด์',
  Espresso: 'เอสเปรสโซ', Eucalyptus: 'ยูคาลิปตัส', Flame: 'เปลวไฟ', Forest: 'เขียวป่า', French: 'เฟรนช์',
  Fuchsia: 'ฟูเชีย', Geranium: 'เจอเรเนียม', Glass: 'แก้ว', Gold: 'โกลด์', Green: 'เขียว', Grey: 'เทา',
  Heather: 'เฮเทอร์', Honey: 'น้ำผึ้ง', Ink: 'หมึก', Iris: 'ไอริส', Ivory: 'ไอวอรี่', Jade: 'หยก',
  Jet: 'สนิท', Jewel: 'อัญมณี', Kelly: 'เคลลี', Lavender: 'ลาเวนเดอร์', Leaf: 'ใบไม้', Lemon: 'เลมอน',
  Lichen: 'ไลเคน', Lilac: 'ไลแลค', Lime: 'ไลม์', Magenta: 'มาเจนตา', Mahogany: 'มะฮอกกานี',
  Marigold: 'ดาวเรือง', Mauve: 'มอวฟ์', Melon: 'เมลอน', Midnight: 'มิดไนต์', Mint: 'มินต์', Mist: 'หมอก',
  Moss: 'มอส', Mulberry: 'มัลเบอร์รี', Mushroom: 'มัชรูม', Mustard: 'มัสตาร์ด', Navy: 'เนวี่',
  Oat: 'โอ๊ต', Oatmeal: 'โอ๊ตมีล', Ochre: 'โอเชอร์', Olive: 'โอลีฟ', Orange: 'ส้ม', Orchid: 'ออร์คิด',
  Oxblood: 'เลือดวัว', Oyster: 'ออยสเตอร์', Papaya: 'มะละกอ', Paprika: 'ปาปริกา', Peach: 'พีช',
  Peacock: 'นกยูง', Pearl: 'มุก', Periwinkle: 'เพอริวิงเคิล', Persimmon: 'ลูกพลับ', Petal: 'กลีบดอก',
  Petrol: 'เปโตรล', Pewter: 'พิวเตอร์', Pine: 'สน', Pink: 'ชมพู', Platinum: 'แพลทินัม', Plum: 'พลัม',
  Poppy: 'ป๊อปปี้', Pumpkin: 'ฟักทอง', Purple: 'ม่วง', Raspberry: 'ราสป์เบอร์รี', Red: 'แดง', Rose: 'โรส',
  Rosewater: 'โรสวอเตอร์', Royal: 'รอยัล', Ruby: 'รูบี', Rust: 'สนิม', Sage: 'เซจ', Sapphire: 'แซฟไฟร์',
  Sea: 'ทะเล', Seafoam: 'ซีโฟม', Silver: 'เงิน', Sky: 'ฟ้า', Slate: 'สเลต', Stone: 'สโตน', Storm: 'สตอร์ม',
  Sunshine: 'แสงแดด', Tan: 'แทน', Taupe: 'โทป', Teal: 'ทีล', Terracotta: 'เทอร์ราคอตตา', Tobacco: 'ยาสูบ',
  Tomato: 'มะเขือเทศ', Turquoise: 'เทอร์ควอยซ์', Violet: 'ไวโอเล็ต', Watermelon: 'แตงโม', White: 'ขาว', Yellow: 'เหลือง',
}

export function translateColorNameThai(name: string) {
  const exact = exactThai[name]
  if (exact) return exact
  const parts = name.split(' ')
  const suffixes: string[] = []
  const base = parts.filter((part) => {
    const suffix = modifierSuffixes[part]
    if (suffix) { suffixes.push(suffix); return false }
    return true
  })
  const translated = base.map((part) => thaiTerms[part]).filter(Boolean).join('')
  return `${translated || 'สี'}${suffixes.join('')}`
}

export function hasCompleteThaiColorName(name: string) {
  if (exactThai[name]) return true
  return name.split(' ').every((part) => Boolean(modifierSuffixes[part] || thaiTerms[part]))
}

export function translateMetalNoteThai(name: string) {
  if (/Rose/.test(name)) return 'ประกายชมพูอุ่นที่ดูกลมกลืนและนุ่มนวล'
  if (/Silver|White Gold|Platinum/.test(name)) return 'ประกายโทนเย็นที่ช่วยเสริมความคมชัดของพาเลตต์'
  if (/Bronze|Copper/.test(name)) return 'ประกายอบอุ่นที่มีมิติและดูเป็นธรรมชาติ'
  return 'ประกายโทนอุ่นที่รับกับสีโดยรวมของพาเลตต์'
}
