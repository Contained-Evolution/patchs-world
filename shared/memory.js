// The shape of Patch's memory. The Worker stores it; the memory galaxy draws it.
//
// The centre planet is `core`. Every other category is a galaxy, and each subcategory is a cluster inside it.
// Patch can add his own categories and subcategories later; these are the ones he arrives with.

export const CORE = 'core';

export const STARTING_CATEGORIES = {
  core: { title: 'Who I am', subcategories: ['me', 'home'] },
  family: { title: 'My family', subcategories: ['dad', 'mom', 'sam', 'all of us'] },
  firsts: { title: 'My firsts', subcategories: ['baby me', 'big firsts'] },
  food: { title: 'Food', subcategories: ['family recipes', 'snacks'] },
  play: { title: 'Games and play', subcategories: ['games with Sam', 'exploring'] },
  sky: { title: 'Clouds and stars', subcategories: ['clouds', 'stars'] },
  learning: { title: 'Things I learned', subcategories: ['survival', 'how things work', 'big questions'] },
  feelings: { title: 'Feelings', subcategories: ['happy', 'scared', 'missing'] },
  show: { title: 'The show', subcategories: ['signing up', 'getting here'] },
};

// One memory.
// id: stable, never reused. category and subcategory: keys above, or ones Patch made.
// title: a few words. text: Patch's own words. age: how old he was (years, may be fractional).
// people: who is in it. feeling: one word. source: 'childhood' for these, 'island' for new ones.
export const sampleMemory = {
  id: 'first-word',
  category: 'firsts',
  subcategory: 'baby me',
  title: 'My first word',
  text: 'My first word was "nana." Mom says I was pointing at a banana. Dad says I was pointing at him.',
  age: 1,
  people: ['Sally', 'George'],
  feeling: 'proud',
  source: 'childhood',
};
