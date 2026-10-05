module.exports = {
    content: ['./index.html', './streamcard.html', './js/**/*.js'],
    safelist: [{ pattern: /^(bg|text|border)-(gray|green|red|blue|yellow|purple)-(400|500|600|700|800)$/ }],
    plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography'), require('@tailwindcss/aspect-ratio')]
};
