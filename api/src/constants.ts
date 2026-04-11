export const VALID_CATEGORIES = ['workplace', 'relationship', 'family', 'friends', 'money', 'neighbors'] as const;
export type Category = typeof VALID_CATEGORIES[number];
