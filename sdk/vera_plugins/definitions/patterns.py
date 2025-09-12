import re

PLUGIN_META_PATTERN = re.compile(r"\.veraplugin\.ya?ml$")
PLUGIN_INSTANCES_PATTERN = re.compile(r"\.veraplugin\.instances\.ya?ml$")

GIT_HTTP_URL_PATTERN = re.compile(
    r"^(https?://[^@:\s]+\.git)(?:@([\w\-/\.]+))?(?::([\w\-/\.]+))?$"
)

VERSION_PATTERN = r"^\d+\.\d+\.\d+(-\w+)?$"
