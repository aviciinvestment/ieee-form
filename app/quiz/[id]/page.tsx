import { QuizTaker } from "@/components/quiz-taker";

export const metadata = {
  title: "Take quiz | IEEE 30 Days Skill Challenge",
};

export default function TakeQuizPage({ params }: { params: { id: string } }) {
  return <QuizTaker quizId={params.id} />;
}