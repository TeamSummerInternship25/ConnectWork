-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "currentQuestionIndex" INTEGER,
ADD COLUMN     "lastUpdated" TIMESTAMP(3);
