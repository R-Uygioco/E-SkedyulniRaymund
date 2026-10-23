import type { BackTarget } from "./shared/native"
import { WIZARD_BACK_TARGETS, type WizardScreen } from "./features/wizard/navigation"
import { AVAILABILITY_BACK_TARGETS, type AvailabilityScreen } from "./features/availability/navigation"
import { SLOTS_BACK_TARGETS, type SlotsScreen } from "./features/slots/navigation"

export type AuthScreen = "sign-in" | "sign-up" | "forgot-password"

// Every screen in the app. Each feature lists its own screens in its navigation.ts.
export type Screen = WizardScreen | AuthScreen | "home" | "admin-login" | "admin" | AvailabilityScreen | SlotsScreen

// Where the Android back button goes from each screen.
export const BACK_TARGETS: Record<Screen, BackTarget<Screen>> = {
  ...WIZARD_BACK_TARGETS,
  "sign-in": "welcome",
  "sign-up": "previous",
  "forgot-password": "sign-in",
  home: "minimize",
  "admin-login": "welcome",
  admin: "home",
  ...AVAILABILITY_BACK_TARGETS,
  ...SLOTS_BACK_TARGETS,
}
