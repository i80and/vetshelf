import ctypes

__all__ = ('tame', 'TAME_MALLOC', 'TAME_RW', 'TAME_STDIO', 'TAME_RPATH', 'TAME_WPATH',
                 'TAME_TMPPATH', 'TAME_INET', 'TAME_UNIX', 'TAME_CMSG', 'TAME_DNS',
                 'TAME_IOCTL', 'TAME_GETPW', 'TAME_PROC', 'TAME_CPATH', 'TAME_ABORT')

try:
    _tame = ctypes.cdll.LoadLibrary('libc.so.80')['tame']
    _tame.argtypes = (ctypes.c_int,)
except (OSError, AttributeError):
    _tame = lambda flags: -1

_TM_SELF    = 0x00000001
_TM_RW      = 0x00000002
_TM_MALLOC  = 0x00000004
_TM_DNSPATH = 0x00000008
_TM_RPATH   = 0x00000010
_TM_WPATH   = 0x00000020
_TM_TMPPATH = 0x00000040
_TM_INET    = 0x00000080
_TM_UNIX    = 0x00000100
_TM_CMSG    = 0x00000200
_TM_IOCTL   = 0x00000400
_TM_GETPW   = 0x00000800
_TM_PROC    = 0x00001000
_TM_CPATH   = 0x00002000
_TM_ABORT   = 0x08000000

TAME_MALLOC  = (_TM_SELF | _TM_MALLOC)
TAME_RW      = (_TM_SELF | _TM_RW)
TAME_STDIO   = (_TM_SELF | _TM_MALLOC | _TM_RW)
TAME_RPATH   = (_TM_SELF | _TM_RW | _TM_RPATH)
TAME_WPATH   = (_TM_SELF | _TM_RW | _TM_WPATH)
TAME_TMPPATH = (_TM_SELF | _TM_RW | _TM_TMPPATH)
TAME_INET    = (_TM_SELF | _TM_RW | _TM_INET)
TAME_UNIX    = (_TM_SELF | _TM_RW | _TM_UNIX)
TAME_CMSG    = (TAME_UNIX | _TM_CMSG)
TAME_DNS     = (TAME_MALLOC | _TM_DNSPATH)
TAME_IOCTL   = (_TM_IOCTL)
TAME_GETPW   = (TAME_STDIO | _TM_GETPW)
TAME_PROC    = (_TM_PROC)
TAME_CPATH   = (_TM_CPATH)
TAME_ABORT   = (_TM_ABORT)

def tame(flags: int) -> int:
    """Use the OpenBSD tame(2) syscall if available to drop the to given
       capabilities."""
    return _tame(flags)
