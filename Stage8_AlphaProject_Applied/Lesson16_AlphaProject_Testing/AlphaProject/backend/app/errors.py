class WatchlistError(Exception):
    """Domain error for watchlist business rule violations.

    Carries a user-facing Chinese message; API layer surfaces this verbatim
    so the UI can show it directly (PRD §6 F5 error copy).
    """
