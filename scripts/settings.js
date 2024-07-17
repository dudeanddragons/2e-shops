// scripts/settings.js
Hooks.once('init', () => {
    game.settings.register('2e-shops', 'currencySymbol', {
      name: "Currency Symbol",
      hint: "Set the symbol for your game's currency.",
      scope: 'world',
      config: true,
      default: '$',
      type: String
    });
  });
  