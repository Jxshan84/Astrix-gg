function uniqueIds(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function allowedMentions({ users = [], roles = [], repliedUser = false, parse = [] } = {}) {
  return {
    parse: [...new Set(parse)],
    users: uniqueIds(users),
    roles: uniqueIds(roles),
    repliedUser: Boolean(repliedUser)
  };
}

module.exports = { uniqueIds, allowedMentions };
