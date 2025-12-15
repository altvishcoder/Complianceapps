import * as React from "react"
import { ShieldCheck } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export function Captcha() {
  const [checked, setChecked] = React.useState(false)

  return (
    <div className="flex items-center p-4 border rounded-md bg-muted/10 shadow-sm w-full">
      <div className="flex items-center space-x-3">
        <Checkbox 
          id="captcha" 
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="h-6 w-6 border-2 checked:bg-emerald-500 checked:border-emerald-500"
        />
        <Label htmlFor="captcha" className="text-sm font-medium cursor-pointer">
          I am not a robot
        </Label>
      </div>
      <div className="ml-auto flex flex-col items-center justify-center text-[10px] text-muted-foreground">
        <ShieldCheck className="h-5 w-5 mb-0.5 opacity-50" />
        <span>reCAPTCHA</span>
      </div>
    </div>
  )
}
