from mzk_aleph import (
    AlephOAISession,
    AlephXSession,
    AlephMzkClient,
    NkpZ3950Session,
    AlephSkcClient,
    AlephCnbClient,
)
from config import VeraConfig
from apscheduler.triggers.date import DateTrigger
from vera_scheduler import vera_scheduler
from datetime import timedelta


mzk_oai_session = None
mzk_x_session = None
nkp_z3950_session = None


def _close_mzk_sessions():
    global mzk_oai_session, mzk_x_session

    mzk_oai_session.close()
    mzk_oai_session = None

    mzk_x_session.close()
    mzk_x_session = None


def _reset_mzk_sessions_ttl():
    vera_scheduler.add_job(
        _close_mzk_sessions,
        DateTrigger(
            run_date=VeraConfig.Timestamp
            + timedelta(seconds=VeraConfig.AlephMzk.TTL)
        ),
        name="close_mzk_sessions",
    )


def _create_mzk_sessions():
    global mzk_oai_session, mzk_x_session

    mzk_oai_session = AlephOAISession(VeraConfig.AlephMzk.Host)
    mzk_x_session = AlephXSession(VeraConfig.AlephMzk.Host)

    _reset_mzk_sessions_ttl()


def _close_nkp_session():
    global nkp_z3950_session

    nkp_z3950_session.close()
    nkp_z3950_session = None


def _reset_nkp_session_ttl():
    vera_scheduler.add_job(
        _close_nkp_session,
        DateTrigger(
            run_date=VeraConfig.Timestamp
            + timedelta(seconds=VeraConfig.AlephMzk.TTL)
        ),
        name="close_nkp_session",
    )


def _create_nkp_session():
    global nkp_z3950_session

    nkp_z3950_session = NkpZ3950Session(
        VeraConfig.AlephNkp.Url,
        VeraConfig.AlephNkp.Port,
        VeraConfig.AlephNkp.RateLimitMs,
    )

    _reset_nkp_session_ttl()


def get_mzk_client():
    global mzk_oai_session, mzk_x_session

    if mzk_oai_session is None or mzk_x_session is None:
        _create_mzk_sessions()
    else:
        _reset_mzk_sessions_ttl()

    return AlephMzkClient(mzk_oai_session, mzk_x_session)


def get_skc_client():
    global nkp_z3950_session

    if nkp_z3950_session is None:
        _create_nkp_session()
    else:
        _reset_nkp_session_ttl()

    return AlephSkcClient(nkp_z3950_session)


def get_cnb_client():
    global nkp_z3950_session

    if nkp_z3950_session is None:
        _create_nkp_session()
    else:
        _reset_nkp_session_ttl()

    return AlephCnbClient(nkp_z3950_session)
