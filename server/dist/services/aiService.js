"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiService = void 0;
const sdk_1 = require("@anthropic-ai/sdk");
const client_1 = require("@prisma/client");
const xfyunAiService_1 = require("./xfyunAiService");
const prisma = new client_1.PrismaClient();
class AIService {
    constructor() {
        this.anthropic = null;
        this.isEnabled = false;
        if (xfyunAiService_1.xfyunAiService.isAvailable()) {
            console.log('✅ AI Service initialized with Xfyun Spark');
            this.isEnabled = true;
            this.anthropic = null;
            return;
        }
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (apiKey && apiKey !== 'fake-anthropic-key-for-testing') {
            this.anthropic = new sdk_1.Anthropic({ apiKey });
            this.isEnabled = true;
            console.log('✅ AI Service initialized with Anthropic (fallback)');
        }
        else {
            console.warn('⚠️  AI Service disabled: No valid API key found');
        }
    }
    async generateQuizFromText(content, options = {}) {
        if (!this.isEnabled) {
            return this.generateMockQuestions(options.questionCount || 3);
        }
        const { difficulty = 'medium', questionCount = 3, focusAreas = [] } = options;
        const maxContentLength = 8000;
        if (content.length > maxContentLength) {
            console.log(`📄 Content is long (${content.length} chars), using segmented generation...`);
            return this.generateQuizFromLongContent(content, options);
        }
        try {
            if (this.isEnabled && xfyunAiService_1.xfyunAiService.isAvailable()) {
                console.log('🤖 Using Xfyun Spark AI for quiz generation...');
                try {
                    const quizData = await xfyunAiService_1.xfyunAiService.generateQuiz(content, {
                        questionCount,
                        difficulty,
                        timeLimit: options.timeLimit || 10
                    });
                    const processedQuestions = this.processXfyunQuizResponse(quizData);
                    if (processedQuestions.length === 0) {
                        throw new Error('No valid questions generated');
                    }
                    console.log(`✅ Generated ${processedQuestions.length} questions using Xfyun AI`);
                    return processedQuestions;
                }
                catch (xfyunError) {
                    console.error('❌ Xfyun AI generation failed:', xfyunError);
                }
            }
            if (this.anthropic) {
                console.log('🤖 Fallback to Anthropic AI...');
                const prompt = this.buildQuizGenerationPrompt(content, difficulty, questionCount, focusAreas);
                const response = await this.anthropic.messages.create({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 2000,
                    messages: [{
                            role: 'user',
                            content: prompt
                        }]
                });
                const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
                return this.parseQuizResponse(responseText);
            }
            throw new Error('No AI service available');
        }
        catch (error) {
            console.error('❌ All AI quiz generation methods failed:', error);
            console.log('🔄 Falling back to mock questions...');
            return this.generateMockQuestions(questionCount);
        }
    }
    async evaluateQuizQuality(questions, originalContent, userFeedback) {
        if (!this.isEnabled) {
            return this.generateMockQualityFeedback();
        }
        const basicQuality = this.performBasicQualityCheck(questions, originalContent);
        if (!basicQuality.isAcceptable) {
            return basicQuality;
        }
        try {
            const prompt = this.buildQualityEvaluationPrompt(questions, originalContent, userFeedback);
            if (this.isEnabled && xfyunAiService_1.xfyunAiService.isAvailable()) {
                console.log('🤖 Using Xfyun Spark AI for quality evaluation...');
                try {
                    const messages = [
                        {
                            role: 'system',
                            content: 'You are an expert quiz quality evaluator. Evaluate quiz questions based on content relevance, difficulty, clarity, and overall quality.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ];
                    const response = await xfyunAiService_1.xfyunAiService.chat(messages, '4.0Ultra');
                    const qualityFeedback = this.parseQualityFeedback(response);
                    return this.combineQualityFeedback(basicQuality, qualityFeedback);
                }
                catch (xfyunError) {
                    console.error('❌ Xfyun quality evaluation failed:', xfyunError);
                    return basicQuality;
                }
            }
            if (this.anthropic) {
                const response = await this.anthropic.messages.create({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1000,
                    messages: [{
                            role: 'user',
                            content: prompt
                        }]
                });
                const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
                const qualityFeedback = this.parseQualityFeedback(responseText);
                return this.combineQualityFeedback(basicQuality, qualityFeedback);
            }
            return basicQuality;
        }
        catch (error) {
            console.error('❌ AI quality evaluation failed:', error);
            return basicQuality;
        }
    }
    async improveQuizQuestions(questions, qualityFeedback, originalContent) {
        if (!this.isEnabled || qualityFeedback.isAcceptable) {
            return questions;
        }
        if (qualityFeedback.score <= 3) {
            console.log('🔄 Quality too low, regenerating instead of improving...');
            return this.generateQuizFromText(originalContent, {
                questionCount: questions.length,
                difficulty: 'medium'
            });
        }
        try {
            const prompt = this.buildImprovementPrompt(questions, qualityFeedback, originalContent);
            if (this.isEnabled && xfyunAiService_1.xfyunAiService.isAvailable()) {
                console.log('🤖 Using Xfyun Spark AI for quiz improvement...');
                try {
                    const messages = [
                        {
                            role: 'system',
                            content: 'You are an expert quiz generator. Improve quiz questions based on quality feedback to make them more relevant, clear, and appropriately challenging.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ];
                    const response = await xfyunAiService_1.xfyunAiService.chat(messages, '4.0Ultra');
                    const improvedQuestions = this.parseQuizResponse(response);
                    if (improvedQuestions.length > 0) {
                        console.log(`✅ Improved ${improvedQuestions.length} questions using Xfyun AI`);
                        return improvedQuestions;
                    }
                    else {
                        throw new Error('No improved questions generated');
                    }
                }
                catch (xfyunError) {
                    console.error('❌ Xfyun improvement failed:', xfyunError);
                }
            }
            if (this.anthropic) {
                console.log('🤖 Fallback to Anthropic for improvement...');
                const response = await this.anthropic.messages.create({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 2000,
                    messages: [{
                            role: 'user',
                            content: prompt
                        }]
                });
                const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
                return this.parseQuizResponse(responseText);
            }
            console.log('⚠️ AI improvement not available, returning original questions');
            return questions;
        }
        catch (error) {
            console.error('❌ AI quiz improvement failed:', error);
            return questions;
        }
    }
    async generateQuizWithQualityLoop(content, options = {}, maxIterations = 3) {
        console.log('🔄 开始质量反馈闭环生成...');
        const qualityHistory = [];
        let currentQuestions = [];
        let iterations = 0;
        try {
            console.log('📝 生成初始题目...');
            currentQuestions = await this.generateQuizFromText(content, options);
            if (currentQuestions.length === 0) {
                console.log('❌ 初始题目生成失败，使用模拟题目');
                currentQuestions = this.generateMockQuestions(options.questionCount || 3);
            }
            console.log(`✅ 初始生成 ${currentQuestions.length} 道题目`);
            for (iterations = 1; iterations <= maxIterations; iterations++) {
                console.log(`🔍 第${iterations}轮质量评估...`);
                try {
                    const qualityFeedback = await this.evaluateQuizQuality(currentQuestions, content);
                    qualityHistory.push(qualityFeedback);
                    console.log(`📊 质量评分: ${qualityFeedback.score}/10, 可接受: ${qualityFeedback.isAcceptable}`);
                    if (qualityFeedback.issues.length > 0) {
                        console.log('⚠️ 发现质量问题:', qualityFeedback.issues.slice(0, 3));
                    }
                    if (qualityFeedback.isAcceptable) {
                        console.log(`✅ 质量达标，第${iterations}轮完成闭环`);
                        break;
                    }
                    if (iterations === maxIterations) {
                        console.log(`⚠️ 达到最大迭代次数(${maxIterations})，使用当前版本`);
                        break;
                    }
                    console.log(`🔧 第${iterations}轮改进题目...`);
                    const improvedQuestions = await this.improveQuizQuestions(currentQuestions, qualityFeedback, content);
                    if (improvedQuestions.length > 0) {
                        currentQuestions = improvedQuestions;
                        console.log(`✨ 题目已改进，准备下一轮评估`);
                    }
                    else {
                        console.log(`⚠️ 改进失败，保持当前版本`);
                        break;
                    }
                }
                catch (evaluationError) {
                    console.error(`❌ 第${iterations}轮评估失败:`, evaluationError);
                    const basicFeedback = this.performBasicQualityCheck(currentQuestions, content);
                    qualityHistory.push(basicFeedback);
                    if (basicFeedback.isAcceptable) {
                        break;
                    }
                }
            }
            const finalQuality = qualityHistory[qualityHistory.length - 1] || this.generateMockQualityFeedback();
            console.log(`🎯 质量反馈闭环完成:`);
            console.log(`   - 迭代次数: ${iterations}`);
            console.log(`   - 最终质量评分: ${finalQuality.score}/10`);
            console.log(`   - 质量可接受: ${finalQuality.isAcceptable}`);
            console.log(`   - 生成题目数: ${currentQuestions.length}`);
            return {
                questions: currentQuestions,
                qualityHistory,
                iterations,
                finalQuality
            };
        }
        catch (error) {
            console.error('❌ 质量反馈闭环失败:', error);
            if (currentQuestions.length > 0) {
                const fallbackQuality = {
                    score: 5.0,
                    issues: ['Quality loop failed, using fallback'],
                    suggestions: ['Manual review recommended'],
                    isAcceptable: false
                };
                return {
                    questions: currentQuestions,
                    qualityHistory: qualityHistory.length > 0 ? qualityHistory : [fallbackQuality],
                    iterations,
                    finalQuality: fallbackQuality
                };
            }
            throw error;
        }
    }
    buildQuizGenerationPrompt(content, difficulty, questionCount, focusAreas) {
        const focusText = focusAreas.length > 0 ? `Focus on these areas: ${focusAreas.join(', ')}` : '';
        return `
Based on the following content, generate ${questionCount} multiple-choice questions with difficulty level: ${difficulty}.

Content:
${content}

${focusText}

Requirements:
1. Each question should have exactly 4 options (A, B, C, D)
2. Only one option should be correct
3. Questions should test understanding, not just memorization
4. Avoid questions that are too obvious or too obscure
5. Include explanations for the correct answers
6. Questions should be relevant to the main topics in the content

Please respond in the following JSON format:
{
  "questions": [
    {
      "question": "Question text here?",
      "optionA": "First option",
      "optionB": "Second option", 
      "optionC": "Third option",
      "optionD": "Fourth option",
      "correctAnswer": "A",
      "explanation": "Why this answer is correct",
      "difficulty": "medium",
      "topic": "Main topic this question covers"
    }
  ]
}
`;
    }
    buildQualityEvaluationPrompt(questions, originalContent, userFeedback) {
        const feedbackText = userFeedback ? `User feedback: ${userFeedback}` : '';
        return `
Evaluate the quality of these quiz questions based on the original content:

Original Content:
${originalContent}

Questions:
${JSON.stringify(questions, null, 2)}

${feedbackText}

Please evaluate based on:
1. Relevance to the content (1-10)
2. Appropriate difficulty level (1-10)
3. Clear and unambiguous wording (1-10)
4. Correct answer accuracy (1-10)
5. Distractor quality (wrong options should be plausible) (1-10)

Respond in JSON format:
{
  "score": 7.5,
  "issues": ["List of specific issues found"],
  "suggestions": ["List of improvement suggestions"],
  "isAcceptable": true
}
`;
    }
    buildImprovementPrompt(questions, feedback, originalContent) {
        return `
Improve these quiz questions based on the quality feedback:

Original Content:
${originalContent}

Current Questions:
${JSON.stringify(questions, null, 2)}

Quality Issues:
${feedback.issues.join('\n')}

Improvement Suggestions:
${feedback.suggestions.join('\n')}

Please generate improved questions in the same JSON format as before.
`;
    }
    parseQuizResponse(response) {
        try {
            let cleanResponse = response.trim();
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            }
            else if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            try {
                const parsed = JSON.parse(cleanResponse);
                if (parsed.questions && Array.isArray(parsed.questions)) {
                    return parsed.questions;
                }
            }
            catch (directParseError) {
                console.log('Direct parse failed, trying to extract JSON...');
            }
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            let jsonStr = jsonMatch[0];
            const lastBraceIndex = jsonStr.lastIndexOf('}');
            if (lastBraceIndex !== -1) {
                jsonStr = jsonStr.substring(0, lastBraceIndex + 1);
            }
            const parsed = JSON.parse(jsonStr);
            return parsed.questions || [];
        }
        catch (error) {
            console.error('Failed to parse AI response:', error);
            console.error('Response content:', response.substring(0, 500) + '...');
            return this.generateMockQuestions(3);
        }
    }
    parseQualityFeedback(response) {
        try {
            let cleanResponse = response.trim();
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            }
            else if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            try {
                const parsed = JSON.parse(cleanResponse);
                if (parsed.score !== undefined && parsed.isAcceptable !== undefined) {
                    return {
                        score: parsed.score || 5.0,
                        issues: parsed.issues || [],
                        suggestions: parsed.suggestions || [],
                        isAcceptable: parsed.isAcceptable || false
                    };
                }
            }
            catch (directParseError) {
                console.log('Direct parse failed for quality feedback, trying to extract JSON...');
            }
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            let jsonStr = jsonMatch[0];
            const lastBraceIndex = jsonStr.lastIndexOf('}');
            if (lastBraceIndex !== -1) {
                jsonStr = jsonStr.substring(0, lastBraceIndex + 1);
            }
            const parsed = JSON.parse(jsonStr);
            return {
                score: parsed.score || 5.0,
                issues: parsed.issues || [],
                suggestions: parsed.suggestions || [],
                isAcceptable: parsed.isAcceptable || false
            };
        }
        catch (error) {
            console.error('Failed to parse quality feedback:', error);
            console.error('Response content:', response.substring(0, 500) + '...');
            return this.generateMockQualityFeedback();
        }
    }
    generateMockQuestions(count) {
        const mockQuestions = [];
        for (let i = 1; i <= count; i++) {
            mockQuestions.push({
                question: `Sample question ${i} about the presentation content?`,
                optionA: `Option A for question ${i}`,
                optionB: `Option B for question ${i}`,
                optionC: `Option C for question ${i}`,
                optionD: `Option D for question ${i}`,
                correctAnswer: 'A',
                explanation: `This is the correct answer because it directly relates to the main topic discussed in the presentation.`,
                difficulty: 'medium',
                topic: 'General Content'
            });
        }
        return mockQuestions;
    }
    generateMockQualityFeedback() {
        return {
            score: 7.5,
            issues: ['Questions could be more specific to the content'],
            suggestions: ['Add more context-specific details', 'Improve distractor options'],
            isAcceptable: true
        };
    }
    generateStrictQualityFeedback() {
        return {
            score: 5.0,
            issues: [
                'Questions are too shallow and lack depth',
                'Distractors are not plausible enough',
                'Questions do not test understanding but only recall'
            ],
            suggestions: [
                'Add more analytical questions that test comprehension',
                'Improve distractor quality with more realistic wrong answers',
                'Include questions that require application of concepts'
            ],
            isAcceptable: false
        };
    }
    async generateQuizFromLongContent(content, options = {}) {
        const { questionCount = 3 } = options;
        const maxSegmentLength = 6000;
        const segments = this.splitContentIntoSegments(content, maxSegmentLength);
        console.log(`📄 Split content into ${segments.length} segments`);
        const allQuestions = [];
        const questionsPerSegment = Math.ceil(questionCount / segments.length);
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const segmentQuestionCount = Math.min(questionsPerSegment, questionCount - allQuestions.length);
            if (segmentQuestionCount <= 0)
                break;
            console.log(`🔄 Processing segment ${i + 1}/${segments.length} (${segment.length} chars, ${segmentQuestionCount} questions)`);
            try {
                const segmentQuestions = await this.generateQuizFromText(segment, {
                    ...options,
                    questionCount: segmentQuestionCount
                });
                allQuestions.push(...segmentQuestions);
                if (i < segments.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            catch (error) {
                console.warn(`⚠️ Failed to generate questions for segment ${i + 1}:`, error);
            }
        }
        console.log(`✅ Generated ${allQuestions.length} questions from ${segments.length} segments`);
        return allQuestions;
    }
    splitContentIntoSegments(content, maxLength) {
        const segments = [];
        const paragraphs = content.split(/\n\s*\n/);
        let currentSegment = '';
        for (const paragraph of paragraphs) {
            if (paragraph.length > maxLength) {
                if (currentSegment.trim()) {
                    segments.push(currentSegment.trim());
                    currentSegment = '';
                }
                const sentences = paragraph.split(/[。！？.!?]\s*/);
                let sentenceGroup = '';
                for (const sentence of sentences) {
                    if (sentenceGroup.length + sentence.length > maxLength) {
                        if (sentenceGroup.trim()) {
                            segments.push(sentenceGroup.trim());
                        }
                        sentenceGroup = sentence;
                    }
                    else {
                        sentenceGroup += (sentenceGroup ? '。' : '') + sentence;
                    }
                }
                if (sentenceGroup.trim()) {
                    currentSegment = sentenceGroup;
                }
            }
            else {
                if (currentSegment.length + paragraph.length > maxLength) {
                    if (currentSegment.trim()) {
                        segments.push(currentSegment.trim());
                    }
                    currentSegment = paragraph;
                }
                else {
                    currentSegment += (currentSegment ? '\n\n' : '') + paragraph;
                }
            }
        }
        if (currentSegment.trim()) {
            segments.push(currentSegment.trim());
        }
        return segments.filter(segment => segment.length > 100);
    }
    processXfyunQuizResponse(quizData) {
        if (!quizData || !quizData.questions || !Array.isArray(quizData.questions)) {
            console.error('Invalid quiz response format:', quizData);
            throw new Error('Invalid quiz response format from Xfyun AI');
        }
        return quizData.questions.map((q, index) => {
            if (!q.question || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctAnswer) {
                console.error(`Question ${index + 1} missing required fields:`, q);
                throw new Error(`Question ${index + 1} is incomplete`);
            }
            if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) {
                console.error(`Question ${index + 1} has invalid correctAnswer:`, q.correctAnswer);
                q.correctAnswer = 'A';
            }
            return {
                question: q.question,
                optionA: q.optionA,
                optionB: q.optionB,
                optionC: q.optionC,
                optionD: q.optionD,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || '暂无解释',
                difficulty: q.difficulty || 'medium',
                topic: q.topic || 'General Content',
                order: index
            };
        });
    }
    convertToDbFormat(questions) {
        return questions.map((q, index) => ({
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            order: index
        }));
    }
    async generateQuizWithStrictQualityLoop(content, options = {}, maxIterations = 3) {
        console.log('🔄 开始严格质量反馈闭环生成（测试模式）...');
        const qualityHistory = [];
        let currentQuestions = [];
        let iterations = 0;
        try {
            console.log('📝 生成初始题目...');
            currentQuestions = await this.generateQuizFromText(content, options);
            if (currentQuestions.length === 0) {
                throw new Error('Failed to generate initial questions');
            }
            for (iterations = 1; iterations <= maxIterations; iterations++) {
                console.log(`🔍 第${iterations}轮质量评估（严格模式）...`);
                let qualityFeedback;
                if (iterations <= 2) {
                    qualityFeedback = this.generateStrictQualityFeedback();
                    console.log(`📊 使用严格标准: ${qualityFeedback.score}/10, 可接受: ${qualityFeedback.isAcceptable}`);
                }
                else {
                    qualityFeedback = await this.evaluateQuizQuality(currentQuestions, content);
                    console.log(`📊 真实评估: ${qualityFeedback.score}/10, 可接受: ${qualityFeedback.isAcceptable}`);
                }
                qualityHistory.push(qualityFeedback);
                if (qualityFeedback.issues.length > 0) {
                    console.log('⚠️ 发现质量问题:', qualityFeedback.issues);
                }
                if (qualityFeedback.isAcceptable) {
                    console.log(`✅ 质量达标，第${iterations}轮完成闭环`);
                    break;
                }
                if (iterations === maxIterations) {
                    console.log(`⚠️ 达到最大迭代次数(${maxIterations})，使用当前版本`);
                    break;
                }
                console.log(`🔧 第${iterations}轮改进题目...`);
                const improvedQuestions = await this.improveQuizQuestions(currentQuestions, qualityFeedback, content);
                if (improvedQuestions.length > 0) {
                    currentQuestions = improvedQuestions;
                    console.log(`✨ 题目已改进，准备下一轮评估`);
                }
                else {
                    console.log(`⚠️ 改进失败，保持当前版本`);
                    break;
                }
            }
            const finalQuality = qualityHistory[qualityHistory.length - 1];
            console.log(`🎯 严格质量反馈闭环完成:`);
            console.log(`   - 迭代次数: ${iterations}`);
            console.log(`   - 最终质量评分: ${finalQuality.score}/10`);
            console.log(`   - 质量可接受: ${finalQuality.isAcceptable}`);
            console.log(`   - 生成题目数: ${currentQuestions.length}`);
            return {
                questions: currentQuestions,
                qualityHistory,
                iterations,
                finalQuality
            };
        }
        catch (error) {
            console.error('❌ 严格质量反馈闭环失败:', error);
            throw error;
        }
    }
    performBasicQualityCheck(questions, originalContent) {
        const issues = [];
        let score = 10;
        if (questions.length === 0) {
            issues.push('No questions generated');
            score = 1;
        }
        questions.forEach((q, index) => {
            if (!q.question || q.question.trim().length < 10) {
                issues.push(`Question ${index + 1}: Too short or empty`);
                score -= 1;
            }
            if (!q.optionA || !q.optionB || !q.optionC || !q.optionD) {
                issues.push(`Question ${index + 1}: Missing options`);
                score -= 1;
            }
            if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) {
                issues.push(`Question ${index + 1}: Invalid correct answer`);
                score -= 1;
            }
            const options = [q.optionA, q.optionB, q.optionC, q.optionD];
            const uniqueOptions = new Set(options.map(opt => opt.toLowerCase().trim()));
            if (uniqueOptions.size < 4) {
                issues.push(`Question ${index + 1}: Duplicate or similar options`);
                score -= 0.5;
            }
        });
        const contentWords = originalContent.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        const questionText = questions.map(q => q.question.toLowerCase()).join(' ');
        let relevantWords = 0;
        contentWords.slice(0, 20).forEach(word => {
            if (questionText.includes(word)) {
                relevantWords++;
            }
        });
        if (relevantWords < 2) {
            issues.push('Questions may not be relevant to the provided content');
            score -= 2;
        }
        score = Math.max(1, Math.min(10, score));
        return {
            score,
            issues,
            suggestions: issues.map(issue => `Fix: ${issue}`),
            isAcceptable: score >= 6 && issues.length <= 3
        };
    }
    combineQualityFeedback(basicFeedback, aiFeedback) {
        return {
            score: Math.min(basicFeedback.score, aiFeedback.score),
            issues: [...basicFeedback.issues, ...aiFeedback.issues],
            suggestions: [...basicFeedback.suggestions, ...aiFeedback.suggestions],
            isAcceptable: basicFeedback.isAcceptable && aiFeedback.isAcceptable
        };
    }
}
exports.aiService = new AIService();
//# sourceMappingURL=aiService.js.map