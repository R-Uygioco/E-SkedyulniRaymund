from admin.config import Settings


def test_cors_origins_are_trimmed_and_trailing_slashes_removed(monkeypatch):
    monkeypatch.setenv(
        "CORS_ORIGINS",
        " https://eskedyulniraymund-beta.vercel.app/ , https://preview.example.com/ ",
    )

    settings = Settings.from_env()

    assert settings.cors_origins == (
        "https://eskedyulniraymund-beta.vercel.app",
        "https://preview.example.com",
    )
