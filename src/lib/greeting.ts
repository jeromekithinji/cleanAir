/** Short replies for greetings and a little small talk. */

const GREETING =
	/^(?:hi|hello|hey|hiya|howdy|yo|good morning|good afternoon|good evening|bonjour|salut|allo|allô|bonsoir)(?: there| clair)?$/i

const HOW_ARE_YOU =
	/^(?:how are you|how's it going|hows it going|what's up|whats up|ça va|ca va)$/i

const THANKS = /^(?:thanks|thank you|thank you so much|merci|merci beaucoup)$/i

export function greetingReply (message: string): string | null {
	const text = message
		.trim()
		.toLowerCase()
		.replace(/[!?.]+/g, "")
		.replace(/\s+/g, " ")
	if (GREETING.test(text)) {
		return looksFrench(text)
			? "Salut, comment puis-je vous aider ?"
			: "Hey, how may I help you?"
	}
	if (HOW_ARE_YOU.test(text)) {
		return looksFrench(text)
			? "Ça va bien. Comment puis-je vous aider ?"
			: "I'm doing well. How may I help you?"
	}
	if (THANKS.test(text)) {
		return looksFrench(text)
			? "Avec plaisir. Comment puis-je vous aider ?"
			: "You're welcome. How may I help you?"
	}
	return null
}

function looksFrench (text: string): boolean {
	return /[àâçéèêëîïôùûüœ]|\b(bonjour|salut|bonsoir|merci|ça|ca va|allô|allo)\b/i.test(text)
}
