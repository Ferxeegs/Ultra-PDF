from rembg.sessions import sessions, sessions_class

from app.services.bria_rmbg_14_session import BriaRmBg14Session

_registered = False


def register_bria_rmbg_14() -> None:
    global _registered
    if _registered:
        return

    name = BriaRmBg14Session.name()
    sessions[name] = BriaRmBg14Session
    if BriaRmBg14Session not in sessions_class:
        sessions_class.append(BriaRmBg14Session)
    _registered = True
