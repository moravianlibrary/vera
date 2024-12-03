from mzk_aleph import (
    AlephOAISession,
    AlephXSession,
    AlephMzkClient,
    NkpZ3950Session,
    AlephSkcClient,
    AlephCnbClient,
)
from config import VeraConfig
from datetime import timedelta
from logging import getLogger, DEBUG

logger = getLogger(__name__)
getLogger("apscheduler").setLevel(DEBUG)


class AlephClientsManager:
    def __init__(self, config: VeraConfig):
        self.config = config

        self._mzk_oai_session = None
        self._mzk_x_session = None
        self._mzk_last_used = config.Timestamp

        self._nkp_z3950_session = None
        self._nkp_last_used = config.Timestamp

    def _close_mzk_sessions(self):
        if self._mzk_oai_session is not None:
            logger.info("Closing MZK OAI session.")
            try:
                self._mzk_oai_session.close()
            except Exception as e:
                logger.warning(f"Failed to close MZK OAI session: {e}")
            finally:
                self._mzk_oai_session = None

        if self._mzk_x_session is not None:
            logger.info("Closing MZK X session.")
            try:
                self._mzk_x_session.close()
            except Exception as e:
                logger.warning(f"Failed to close MZK X session: {e}")
            finally:
                self._mzk_x_session = None

    def _close_nkp_session(self):
        if self._nkp_z3950_session is None:
            return

        logger.info("Closing NKP z3950 session.")
        try:
            self._nkp_z3950_session.close()
        except Exception as e:
            logger.warning(f"Failed to close NKP z3950 session: {e}")
        finally:
            self._nkp_z3950_session = None

    def close(self):
        self._close_mzk_sessions()
        self._close_nkp_session()

    def __del__(self):
        self.close()

    def _close_mzk_sessions_if_idle(self):
        if self.config.Timestamp - self._mzk_last_used > timedelta(
            seconds=self.config.AlephMzk.TTL
        ):
            self._close_mzk_sessions()

    def _close_nkp_session_if_idle(self):
        if self.config.Timestamp - self._nkp_last_used > timedelta(
            seconds=self.config.AlephNkp.TTL
        ):
            self._close_nkp_session()

    def _create_mzk_sessions(self):
        self._mzk_oai_session = AlephOAISession(self.config.AlephMzk.Host)
        self._mzk_x_session = AlephXSession(self.config.AlephMzk.Host)

    def _create_nkp_session(self):
        self._nkp_z3950_session = NkpZ3950Session(
            VeraConfig.AlephNkp.Url,
            VeraConfig.AlephNkp.Port,
            VeraConfig.AlephNkp.RateLimitMs,
        )

    @property
    def mzk_client(self):
        self._close_mzk_sessions_if_idle()
        if self._mzk_oai_session is None or self._mzk_x_session is None:
            self._create_mzk_sessions()
        self._mzk_last_used = self.config.Timestamp
        return AlephMzkClient(self._mzk_oai_session, self._mzk_x_session)

    @property
    def skc_client(self):
        self._close_nkp_session_if_idle()
        if self._nkp_z3950_session is None:
            self._create_nkp_session()
        self._nkp_last_used = self.config.Timestamp
        return AlephSkcClient(self._nkp_z3950_session)

    @property
    def cnb_client(self):
        self._close_nkp_session_if_idle()
        if self._nkp_z3950_session is None:
            self._create_nkp_session()
        self._nkp_last_used = self.config.Timestamp
        return AlephCnbClient(self._nkp_z3950_session)


clients_manager = AlephClientsManager(VeraConfig)


def get_mzk_client():
    return clients_manager.mzk_client


def get_skc_client():
    return clients_manager.skc_client


def get_cnb_client():
    return clients_manager.cnb_client
