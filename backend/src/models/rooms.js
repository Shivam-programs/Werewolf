// Active rooms currently live in this process. A production deployment should
// replace this with a shared persistent store (for example Redis) if rooms must
// survive a service restart or run across more than one instance.
export const rooms = {};
