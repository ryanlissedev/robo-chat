# Page snapshot

```yaml
- region "Notifications alt+T"
- main:
  - link "RoboRail":
    - /url: /
    - img: HGG
    - text: RoboRail
  - switch "Day/Night Theme Switch"
  - text: Day/Night Theme Switch
  - button "About RoboRail":
    - img
  - link "Login":
    - /url: /auth
  - img
  - textbox "Ask anything"
  - button "Add files":
    - img
  - button "GPT-5 Mini":
    - img
    - text: GPT-5 Mini
    - img
  - button "Low reasoning effort":
    - img
  - button "Medium reasoning effort" [pressed]:
    - img
  - button "High reasoning effort":
    - img
  - button "Sign in to use voice features"
  - button "Send message" [disabled]:
    - img
- alert
```