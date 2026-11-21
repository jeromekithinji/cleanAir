"""Shared error for slices that are scaffolded and not built yet."""


class FeatureNotReady(Exception):
    def __init__(self, feature: str, module: str) -> None:
        self.feature = feature
        self.module = module
        super().__init__(
            f"{feature} is not implemented yet. Start in {module}."
        )
