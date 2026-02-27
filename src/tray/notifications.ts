import { spawn } from 'child_process'
import { getLogger } from '../logger/index.js'

export interface NotifyOptions {
  title: string
  message: string
  duration?: number
  actions?: Array<{ label: string; id: string }>
  onAction?: (actionId: string) => void
}

export function notify(options: NotifyOptions): void {
  const logger = getLogger()

  const sanitizedTitle = options.title.replace(/'/g, "''")
  const sanitizedMessage = options.message.replace(/'/g, "''")

  const psScript = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null

$APP_ID = 'AEGIS'
$template = @"
<toast>
  <visual>
    <binding template='ToastText02'>
      <text id='1'>${sanitizedTitle}</text>
      <text id='2'>${sanitizedMessage}</text>
    </binding>
  </visual>
</toast>
"@

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml

$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($APP_ID)
$notifier.Show($toast)
  `.trim()

  try {
    spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      psScript,
    ], {
      windowsHide: true,
      stdio: 'ignore',
    })
  } catch (error) {
    logger.warn('Failed to show notification', { error })
  }
}
