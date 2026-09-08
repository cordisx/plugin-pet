import { AVATAR_ENTITY_PRESET_VALUES, AVATAR_PALETTES, AVATAR_TABBY_COMPATIBLE_PALETTE_IDS, AVATAR_DOG_COMPATIBLE_PALETTE_IDS, AVATAR_RABBIT_COMPATIBLE_PALETTE_IDS, AVATAR_BEAR_COMPATIBLE_PALETTE_IDS, type AvatarEntityPreset } from '@oneworks/avatar'
export type PetSpecies = Exclude<AvatarEntityPreset, 'custom'>
export const PET_SPECIES_IDS = AVATAR_ENTITY_PRESET_VALUES.filter((id): id is PetSpecies => id !== 'custom')
export const PET_SPECIES_GROUPS = { companion:'身边伙伴', woodland:'森林伙伴', farm:'牧场伙伴', bird:'飞羽伙伴', water:'水边伙伴', fantasy:'奇妙伙伴' } as const
export type PetSpeciesGroup = keyof typeof PET_SPECIES_GROUPS
// Biology is game tuning; model geometry, palette names and materials remain Avatar-owned.
type Species = {name:string;group:PetSpeciesGroup;weight:number;metabolism:number;palettes:readonly string[]}
const species = (name:string,group:PetSpeciesGroup,weight:number,metabolism:number,palettes:readonly string[]):Species => ({name,group,weight,metabolism,palettes})
export const PET_SPECIES: Record<PetSpecies,Species> = {
  cat:species('猫猫','companion',4,1,[...AVATAR_TABBY_COMPATIBLE_PALETTE_IDS,'cow-cat','black-cat']),
  dog:species('小狗','companion',8,.9,AVATAR_DOG_COMPATIBLE_PALETTE_IDS),
  rabbit:species('兔兔','companion',2,1.2,AVATAR_RABBIT_COMPATIBLE_PALETTE_IDS),
  bear:species('熊熊','woodland',80,.65,AVATAR_BEAR_COMPATIBLE_PALETTE_IDS),
  hamster:species('仓鼠','companion',.15,1.5,['syrian-hamster','pudding-hamster','silver-fox-hamster','sapphire-hamster']),
  capybara:species('水豚','water',45,.75,['capybara','sandy-capybara','dark-capybara','capybara-pup']),
  otter:species('水獭','water',8,1.15,['sea-otter','river-otter','asian-small-clawed-otter']),
  pig:species('小猪','farm',30,.85,['pink-pig','black-pig','spotted-pig','wild-boar']),
  deer:species('小鹿','woodland',35,.8,['sika-deer','reindeer','white-deer','deer-fawn']),
  sheep:species('绵羊','farm',45,.75,['white-sheep','black-faced-sheep','horned-ram','lamb','mountain-goat']),
  alpaca:species('羊驼','farm',50,.7,['cream-alpaca','caramel-alpaca','gray-alpaca','alpaca-cria']),
  cow:species('奶牛','farm',250,.6,['dairy-cow','jersey-cow','highland-cow','cow-calf']),
  squirrel:species('松鼠','woodland',.4,1.4,['red-squirrel','gray-squirrel','chipmunk','black-squirrel']),
  tiger:species('老虎','woodland',100,.65,['bengal-tiger','white-tiger','golden-tiger','tiger-cub']),
  lion:species('狮子','woodland',120,.65,['african-lion','lioness','white-lion','lion-cub']),
  hedgehog:species('刺猬','woodland',.6,1.2,['european-hedgehog','cream-hedgehog','albino-hedgehog','cinnamon-hedgehog']),
  seal:species('海豹','water',60,.75,['harbor-seal','harp-seal','gray-seal','seal-pup']),
  beaver:species('河狸','water',18,.9,['north-american-beaver','eurasian-beaver','dark-beaver','beaver-kit']),
  'guinea-pig':species('豚鼠','companion',1,1.25,['american-guinea-pig','abyssinian-guinea-pig','teddy-guinea-pig','guinea-pig-pup']),
  chinchilla:species('龙猫','companion',.5,1.3,['gray-chinchilla','beige-chinchilla','white-chinchilla','black-velvet-chinchilla']),
  ferret:species('雪貂','companion',1.2,1.3,['sable-ferret','albino-ferret','cinnamon-ferret','panda-ferret']),
  monkey:species('猴子','woodland',5,1.05,['macaque','capuchin-monkey','golden-monkey','baby-monkey']),
  chick:species('小鸡','bird',.2,1.4,['yellow-chick','silkie-chick','barred-rock-chick','buff-orpington-chick']),
  duck:species('鸭鸭','bird',2,1.15,['mallard-duck','pekin-duck','muscovy-duck','yellow-duckling']),
  penguin:species('企鹅','bird',15,.9,['emperor-penguin','adelie-penguin','gentoo-penguin','penguin-chick']),
  owl:species('猫头鹰','bird',1.5,1.15,['barn-owl','snowy-owl','great-horned-owl','little-owl']),
  parrot:species('鹦鹉','bird',.5,1.3,['scarlet-macaw','blue-yellow-macaw','african-grey-parrot','cockatiel']),
  goose:species('鹅鹅','bird',5,1,['greylag-goose','canada-goose','snow-goose','white-gosling']),
  fox:species('狐狸','woodland',6,1.05,['red-fox','arctic-fox','silver-fox','fennec-fox']),
  cloud:species('云朵','fantasy',1,.8,['white','sky','lilac']),
  sun:species('小太阳','fantasy',2,.9,['solar','gold','ember']),
  bun:species('团子','fantasy',1,1,['porcelain','peach','cocoa']),
}
// Fail visibly on an incompatible Avatar release rather than silently showing a fallback palette.
for (const id of PET_SPECIES_IDS) for (const palette of PET_SPECIES[id].palettes) {
  if (!AVATAR_PALETTES.some(item=>item.id === palette)) throw new Error(`Avatar palette missing: ${id}/${palette}`)
}
