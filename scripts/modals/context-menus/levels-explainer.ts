class LevelsExplainer {
	static fixLevelIndicators() {
		// When these panels are first created, for some godforsaken reason they don't have the correct class until you
		// mouse over them... I have absolutely no idea why, this is a quick fix.
		const className = 'levels-explainer__level-indicator';
		for (const p of $.GetContextPanel().FindChildrenWithClassTraverse(className)) p.TriggerClass(className);
	}
}
