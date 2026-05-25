export interface ClickablesData {
  category: string;
  clickable_questions?: (ClickableQuestionsEntity)[] | null;
}
export interface ClickableQuestionsEntity {
  id: string;
  question: string;
}
