export type PaginationModel = {
  show: boolean;
  outOfRange: boolean;
  previous: number | null;
  next: number | null;
  pages: number[];
};

export function paginationModel(
  page: number,
  totalPages: number,
): PaginationModel {
  const outOfRange = totalPages > 0 && page > totalPages;
  if (outOfRange || totalPages < 2) {
    return { show: false, outOfRange, previous: null, next: null, pages: [] };
  }
  return {
    show: true,
    outOfRange: false,
    previous: page > 1 ? page - 1 : null,
    next: page < totalPages ? page + 1 : null,
    pages: Array.from({ length: totalPages }, (_, index) => index + 1),
  };
}
