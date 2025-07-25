"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackType = exports.QuizStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["ORGANIZER"] = "ORGANIZER";
    UserRole["SPEAKER"] = "SPEAKER";
    UserRole["AUDIENCE"] = "AUDIENCE";
})(UserRole || (exports.UserRole = UserRole = {}));
var QuizStatus;
(function (QuizStatus) {
    QuizStatus["DRAFT"] = "DRAFT";
    QuizStatus["ACTIVE"] = "ACTIVE";
    QuizStatus["COMPLETED"] = "COMPLETED";
    QuizStatus["CANCELLED"] = "CANCELLED";
})(QuizStatus || (exports.QuizStatus = QuizStatus = {}));
var FeedbackType;
(function (FeedbackType) {
    FeedbackType["TOO_FAST"] = "TOO_FAST";
    FeedbackType["TOO_SLOW"] = "TOO_SLOW";
    FeedbackType["BORING"] = "BORING";
    FeedbackType["POOR_QUESTIONS"] = "POOR_QUESTIONS";
    FeedbackType["GENERAL"] = "GENERAL";
})(FeedbackType || (exports.FeedbackType = FeedbackType = {}));
//# sourceMappingURL=index.js.map