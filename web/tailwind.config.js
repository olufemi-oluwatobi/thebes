export default {
  darkMode: 'class',
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // themed: these flip in dark mode (see index.css)
        army: { DEFAULT:'rgb(var(--army) / <alpha-value>)', 500:'#3A4A30', 600:'rgb(var(--army-600) / <alpha-value>)', 800:'#1B2517', 900:'#121A0E' },
        onarmy: 'rgb(var(--onarmy) / <alpha-value>)',
        sage: { DEFAULT:'rgb(var(--sage) / <alpha-value>)', 50:'rgb(var(--sage-50) / <alpha-value>)', 100:'rgb(var(--sage-100) / <alpha-value>)', 200:'rgb(var(--sage-200) / <alpha-value>)', 700:'rgb(var(--sage-700) / <alpha-value>)' },
        cream: { DEFAULT:'rgb(var(--cream-100) / <alpha-value>)', 50:'rgb(var(--cream-50) / <alpha-value>)', 100:'rgb(var(--cream-100) / <alpha-value>)', 200:'rgb(var(--cream-200) / <alpha-value>)', 300:'rgb(var(--cream-300) / <alpha-value>)' },
        ink: { DEFAULT:'rgb(var(--ink) / <alpha-value>)', soft:'rgb(var(--ink-soft) / <alpha-value>)', faint:'rgb(var(--ink-faint) / <alpha-value>)' },
        paper: 'rgb(var(--paper) / <alpha-value>)',
        // fixed: always-dark surfaces (feed, floating nav) keep these in both themes
        forest: '#26331F', moss: '#CBD6A8',
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
