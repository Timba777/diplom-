interface FamilyMemberProps {
  initials: string;
  name: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function FamilyMember({ initials, name, isActive, onClick }: FamilyMemberProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-data transition-colors duration-150 ${
        isActive ? "bg-secondary font-medium" : "hover:bg-secondary/50"
      }`}
    >
      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-medium shrink-0">
        {initials}
      </div>
      <span className="truncate">{name}</span>
    </button>
  );
}
