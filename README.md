# Pairup

Help the team by creating a list of pairs from the available team members that changes weekly.

## Requirements

- Able to list pairings from Slack
- Able to add and remove available team members from Slack
- Able to create pairing list even when team members count is odd
- Rotate the pairs weekly
- Return the same result for anyone who asks during the same week
- Don't allow randomness to create repetitive pairings
- Dedupe team member list
- The week should start on Sunday (allows for more timezone difference)
- Follow security best practices for Slack API use
- Protect the identity of people in the lists (since lists will be public)