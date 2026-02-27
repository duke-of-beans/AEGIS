declare module 'systray2' {
  export interface MenuItem {
    title: string
    tooltip: string
    checked: boolean
    enabled: boolean
    items?: MenuItem[]
  }

  export interface Menu {
    icon: string  // base64 PNG/ICO
    title: string
    tooltip: string
    items: MenuItem[]
  }

  export interface ClickAction {
    seq_id: number
    item: MenuItem
  }

  export default class SysTray {
    constructor(options: { menu: Menu; debug?: boolean; copyDir?: boolean })
    onClick(callback: (action: ClickAction) => void): void
    kill(exitNode?: boolean): void
    sendAction(action: { type: string; item?: Menu | MenuItem; seq_id?: number }): void
    readonly killed: boolean
  }
}
