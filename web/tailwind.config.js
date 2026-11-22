export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        army: { DEFAULT:'#26331F', 500:'#3A4A30', 600:'#34432B', 800:'#1B2517', 900:'#121A0E' },
        sage: { DEFAULT:'#CBD6A8', 50:'#F4F7EA', 100:'#E9EED8', 200:'#DCE5BD', 700:'#5E7A2E' },
        cream: { DEFAULT:'#F1F0E4', 50:'#F8F7F0', 100:'#F1F0E4', 200:'#E6E4D3', 300:'#D6D3BE' },
        ink: { DEFAULT:'#1F2A19', soft:'#646B5A', faint:'#8D9384' },
        ember: '#D9693B',
      },
      fontFamily: { sans:['Inter','system-ui','sans-serif'], serif:['"Libre Baskerville"','Georgia','serif'] },
      fontSize: {
        display:['40px',{lineHeight:'48px',letterSpacing:'-0.02em'}],
        title:['30px',{lineHeight:'38px',letterSpacing:'-0.01em'}],
        heading:['20px',{lineHeight:'28px'}],
        subhead:['16px',{lineHeight:'24px'}],
        body:['15px',{lineHeight:'24px'}],
        small:['13px',{lineHeight:'20px'}],
        caption:['12px',{lineHeight:'16px'}],
      },
      boxShadow: {
        card:'0 1px 2px rgb(31 42 25 / .05), 0 8px 24px -12px rgb(31 42 25 / .14)',
        lift:'0 2px 4px rgb(31 42 25 / .06), 0 16px 36px -14px rgb(31 42 25 / .24)',
        pop:'0 24px 60px -16px rgb(18 26 14 / .45)',
      },
      borderRadius: { xl:'14px','2xl':'18px','3xl':'24px', card:'14px' },
    },
  },
  plugins: [],
};
