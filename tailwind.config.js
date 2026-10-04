/** @type {import('tailwindcss').Config} */
export default {
  // The theme service toggles the `dark` class on <html>; without this
  // setting Tailwind would follow the OS preference instead of the class,
  // making the in-app dark/light toggle have no effect.
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
