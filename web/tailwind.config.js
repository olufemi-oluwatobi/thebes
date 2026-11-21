export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        army: { DEFAULT:'#26331F', 600:'#34432B', 800:'#1B2517', 900:'#14200F' },
        sage: { DEFAULT:'#CBD6A8', 50:'#F3F6E8', 100:'#E9EDD6', 200:'#DCE5BD' },
        cream: { DEFAULT:'#F1F0E4', 50:'#F7F6EE', 100:'#F1F0E4', 200:'#E8E6D6' },
        ink: { DEFAULT:'#26331F', soft:'#6B7061' },
        ember: '#E07A4F',
      },
      fontFamily: { sans:['Inter','system-ui','sans-serif'], serif:['"Libre Baskerville"','Georgia','serif'] },
      boxShadow: {
        card:'0 1px 2px rgb(38 51 31 / .04), 0 10px 30px -14px rgb(38 51 31 / .18)',
        pop:'0 20px 50px -12px rgb(20 32 15 / .35)',
      },
      borderRadius: { '2xl':'20px','3xl':'28px' },
    },
  },
  plugins: [],
};
