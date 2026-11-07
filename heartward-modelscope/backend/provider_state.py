"""Process-local circuit breakers; store status codes, never prompts or keys."""
import threading
import time

_lock = threading.Lock()
_states = {}
_LIMIT = threading.BoundedSemaphore(2)


def status(kind):
    with _lock:
        state = dict(_states.get(kind, {"state": "unverified", "reason": "", "retry_at": 0}))
    if state["state"] == "unavailable" and time.monotonic() >= state["retry_at"]:
        state["state"] = "unverified"
    state["retry_after"] = max(0, int(state.pop("retry_at") - time.monotonic()))
    return state


def available(kind):
    return status(kind)["state"] != "unavailable"


def success(kind):
    with _lock:
        _states[kind] = {"state": "ready", "reason": "", "retry_at": 0}


def failure(kind, reason):
    with _lock:
        _states[kind] = {"state": "unavailable", "reason": reason,
                         "retry_at": time.monotonic() + (300 if reason in ("billing", "auth") else 30)}


def reset():
    with _lock:
        _states.clear()


def acquire():
    return _LIMIT.acquire(blocking=False)


def release():
    _LIMIT.release()
