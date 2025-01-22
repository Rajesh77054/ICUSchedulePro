
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

const HOLIDAYS = [
  { id: "new-years", label: "New Year's Day" },
  { id: "easter", label: "Easter Weekend" },
  { id: "memorial", label: "Memorial Day" },
  { id: "july4", label: "July 4th" },
  { id: "labor", label: "Labor Day" },
  { id: "thanksgiving", label: "Thanksgiving Thursday and Friday" },
  { id: "christmas", label: "Christmas Day" },
]

export function HolidayPreferences({ 
  selectedHolidays = [], 
  onHolidayChange 
}: { 
  selectedHolidays: string[]
  onHolidayChange: (holidays: string[]) => void 
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {HOLIDAYS.map((holiday) => (
        <div key={holiday.id} className="flex items-center space-x-2">
          <Checkbox
            id={holiday.id}
            checked={selectedHolidays.includes(holiday.id)}
            onCheckedChange={(checked) => {
              if (checked) {
                onHolidayChange([...selectedHolidays, holiday.id])
              } else {
                onHolidayChange(selectedHolidays.filter(id => id !== holiday.id))
              }
            }}
          />
          <Label htmlFor={holiday.id}>{holiday.label}</Label>
        </div>
      ))}
    </div>
  )
}
