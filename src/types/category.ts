export interface Category {
  id: string;
  title: string;
}

export interface CategoriesResponse {
  _id: string;
  _rev: string;
  type: string;
  categories: Category[];
}
