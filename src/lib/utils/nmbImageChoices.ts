type ImagePreferences = { nmbImageModels?: string[]; nmbImageModel?: string };

export function imageChoices(ui: ImagePreferences): string[] {
	if (Array.isArray(ui.nmbImageModels)) return [...new Set(ui.nmbImageModels.filter((id) => typeof id === 'string' && id.length > 0))];
	return ui.nmbImageModel ? [ui.nmbImageModel] : [];
}

export function imageFeature(ui: ImagePreferences) {
	const models = imageChoices(ui);
	if (models.length > 1) return { models };
	return models.length ? { model: models[0] } : true;
}
