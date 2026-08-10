-- Every tanker log must be submitted by exactly one user type:
-- either an operator or a client, never both and never neither.
ALTER TABLE "TankerLog"
ADD CONSTRAINT "TankerLog_exactly_one_owner_check"
CHECK (num_nonnulls("operatorId", "clientId") = 1);
