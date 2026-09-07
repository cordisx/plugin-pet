/** Small owned vector illustrations, shared by shop and inventory. */
export function PetFoodArt({ id }: { id: string }) {
  return <svg width="96" height="80" viewBox="0 0 120 100" aria-hidden="true" style={{ alignSelf: 'center', flexShrink: 0 }}>
    {id === 'food-snack' ? <>
      <path d="M32 29Q27 18 16 26L12 38 18 52 34 57 47 48 48 34Z" fill="#E4AC62" stroke="#B97636" strokeWidth="3" />
      <path d="M70 45L62 60 66 79 83 87 102 79 109 63 102 49 86 43Z" fill="#EAC080" stroke="#B97636" strokeWidth="3" />
      {[ [25,35], [33,45], [76,58], [94,62], [82,76] ].map(([x,y]) => <rect key={`${x}:${y}`} x={x} y={y} width="5" height="5" rx="1" fill="#81502E" transform={`rotate(12 ${x} ${y})`} />)}
      <path d="m66 14 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#F5D684" />
    </> : id === 'food-meal' ? <>
      <ellipse cx="61" cy="81" rx="46" ry="9" fill="#8EAAAE" opacity=".4" />
      <path d="M20 66Q60 57 103 66L94 84H30Z" fill="#8DB4AF" />
      <circle cx="44" cy="49" r="24" fill="#F5F0DF" stroke="#D6CDB9" strokeWidth="2" />
      <circle cx="77" cy="53" r="25" fill="#EDD3DE" stroke="#D1ADB9" strokeWidth="2" />
      <path d="M31 33q9-7 17-2M65 38q9-7 17-2" fill="none" stroke="#FFFDF7" strokeWidth="5" strokeLinecap="round" />
      <rect x="35" y="48" width="18" height="10" rx="3" fill="#9AAE96" />
      <rect x="69" y="53" width="18" height="10" rx="3" fill="#B6869D" />
      <path d="M38 46v-3m6 3v-3m6 3v-3m22 9v-3m6 3v-3m6 3v-3" stroke="#718B75" strokeWidth="2" />
    </> : id === 'food-feast' ? <>
      <path d="M34 26q-8-8 0-17M59 22q-8-8 0-17M84 26q-8-8 0-17" fill="none" stroke="#B5C1C7" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 57H9v12h14m77-12h11v12H97" fill="none" stroke="#BD694B" strokeWidth="6" strokeLinejoin="round" />
      <path d="M19 52h82q-2 31-25 35H44Q21 83 19 52" fill="#D7835C" />
      <ellipse cx="60" cy="52" rx="41" ry="17" fill="#F4C985" stroke="#BD694B" strokeWidth="4" />
      <path d="M28 50q14-18 29 0t34 0" fill="none" stroke="#F1E8C8" strokeWidth="6" strokeLinecap="round" />
      <path d="m75 40 9-5 5 10-10 3Z" fill="#76996A" /><circle cx="44" cy="55" r="6" fill="#CD6C62" />
      <path d="m55 69-5 9h9l-5 9 14-13h-9l5-5Z" fill="#FFE9A4" />
    </> : <>
      <path d="m60 12 34 20v38L60 90 26 70V32Z" fill="#8BAFC1" stroke="#54798B" strokeWidth="3" />
      <path d="m60 27 20 12v24L60 75 40 63V39Z" fill="#C0E1E7" />
      <path d="M69 41a14 14 0 1 0 4 18M70 34v13H57" fill="none" stroke="#416F80" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </>}
  </svg>
}
