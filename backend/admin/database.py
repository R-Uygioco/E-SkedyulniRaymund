from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


class Database:
    def __init__(self, url: str):
        if not url:
            raise RuntimeError("DATABASE_URL is required.")

        # requirements.txt installs psycopg v3; normalize PostgreSQL URIs
        # without modifying backend/.env.
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url.removeprefix("postgres://")
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url.removeprefix("postgresql://")

        engine_options = {"pool_pre_ping": True}
        if not url.startswith("sqlite:"):
            engine_options.update(
                pool_size=5,
                max_overflow=10,
                pool_recycle=1800,
                pool_timeout=15,
            )

        self.engine = create_engine(url, **engine_options)
        self.factory = sessionmaker(bind=self.engine, autoflush=False, expire_on_commit=False)

    def create_tables(self) -> None:
        from . import models
        Base.metadata.create_all(self.engine)

    @contextmanager
    def session(self) -> Iterator[Session]:
        session = self.factory()
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def dispose(self) -> None:
        self.engine.dispose()
