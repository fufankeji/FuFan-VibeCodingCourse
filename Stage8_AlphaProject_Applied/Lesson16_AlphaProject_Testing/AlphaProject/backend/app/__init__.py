"""AlphaProject backend package.

Process-wide HTTP hygiene: macOS may set a system proxy (127.0.0.1:15732 in
this dev env) via Network Preferences which `requests` picks up via
`urllib.request.getproxies_macosx_sysconf()`. When the proxy daemon isn't
running, *every* outbound HTTP call (AkShare / lark-oapi / OpenAI SDK) dies
with ProxyError. We disable env-proxy honoring at import time so all
HTTP-using libraries go direct. Affects only this process.
"""

try:
    import requests
    import requests.utils as _requests_utils

    _requests_utils.get_environ_proxies = lambda *_args, **_kw: {}
    _orig_session_init = requests.Session.__init__

    def _no_env_session_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        _orig_session_init(self, *args, **kwargs)
        self.trust_env = False
        self.proxies = {}

    requests.Session.__init__ = _no_env_session_init  # type: ignore[method-assign]
except Exception:  # pragma: no cover
    pass
